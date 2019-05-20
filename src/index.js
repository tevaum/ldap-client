import stampit from '@stamp/it';
import { Client }  from 'ldapts';
import { Change }  from 'ldapts/dist/Change';
import { Attribute }  from 'ldapts/dist/Attribute';

const LdapClient = stampit.init(function LdapClient({ ldap }, { stamp }) {
    let client = stamp.compose.configuration.client;

    const type_cache = {};

    this.search = (base, opts) => client.search(base, opts).then(({ searchEntries }) => searchEntries);

    this.bind = (dn, password) => client.bind(dn, password)
	.then(() => return true)
	.catch(err => {
	    if (err typeof InvalidCredentialsError)
		return false;

	    throw err;
	});
    }

    this.add = ({ attrs, meta: { rdn, base } }) => {
        if (!rdn) throw new Error('You must inform "meta.rdn" to add an entry to the ldap server');
        if (!attrs.objectClass) throw new Error('Your object must contain "objectClass" to add an entry to the ldap server');

        const dn = `${rdn}=${attrs[rdn]},${base}`;

        return client.add(dn, attrs);
    };

    this.get = (dn, {attributes = '*'}={}) => {
        let parts = dn.split(',');
        let filter = parts.shift();
        let base = parts.join(',');

        return this.search(base, {scope: 'one', filter, attributes}).then(entries => entries.shift());
    };

    this.register = ({ name, base, scope, filter, attributes, key_field }) => {
        const all = `all_${name.plural}`;
        const one = `get_${name.singular}`;
        const add = `add_${name.singular}`;
        const set = `set_${name.singular}`;
	const find = `find_${name.plural}`;

        this[all] = () => {
            if (Object.prototype.hasOwnProperty.call(type_cache, name.plural)) {
                // console.log('Cache Age:', Date.now() - type_cache[name.plural].updated, 2*60*1000);
                if ((Date.now() - type_cache[name.plural].updated) < 2*60*1000)
                    return Promise.resolve(type_cache[name.plural].data);
            }

            return this.search(base, { attributes, scope: scope || 'sub', filter })
		.then(data => {
		    type_cache[name.plural] = {updated: Date.now(), data};
		    return data;
		});
        }

        this[one] = id => {
	    if (Object.prototype.hasOwnProperty.call(type_cache, name.plural)) {
                // console.log('Cache Age:', Date.now() - type_cache[name.plural].updated, 2*60*1000);
		if ((Date.now() - type_cache[name.plural].updated) < 2*60*1000)
		    return Promise.resolve(type_cache[name.plural].data.find(item => item[key_field] == id));
	    }

	    return this
		.search(base, { attributes, scope: scope || 'sub', filter: `&(${key_field}=${id})(${filter})` })
		.then(res => res.shift());
	}

        // this[add] = ({ attrs, meta }) => this.add({ attrs, meta: Object.assign({}, meta, { base }) });
	this[add] = (id, attributes) => this.add({ attrs: attributes, meta: { rdn: key_field, base } });

        this[set] = (id, attributes) => {
            const dn = id.indexOf(base) > -1 ? id : `${key_field}=${id},${base}`;
            const changes = Object.keys(attributes).map(type => new Change({
		operation: 'replace',
		modification: new Attribute({
		    type,
		    values: attributes[type] instanceof Array ? attributes[type] : [attributes[type]]
		})
	    }));

            return client.modify(dn, changes);
        };

        this[find] = filter_object => {
	    if (Object.prototype.hasOwnProperty.call(type_cache, name.plural)) {
                // console.log('Cache Age:', Date.now() - type_cache[name.plural].updated, 2*60*1000);
		if ((Date.now() - type_cache[name.plural].updated) < 2*60*1000) {
		    return Promise.resolve(type_cache[name.plural].data.filter(item => {
			// Check if item has all properties of filter with the same value
			const result = Object.keys(filter_object).reduce((val, prop) => {
			    return val && (item.hasOwnProperty(prop) && item[prop] == filter_object[prop]);
			}, true);

			return result;
		    }))
		}
	    }

	    const filter = '(&' + Object.keys(filter_object).map(prop => `(${prop}=${filter_object[prop]})`).join('') + ')';

	    return this
		.search(base, { filter, attributes, scope: scope || 'sub' });
	}
    };

    this.disconnect = () => client.unbind();
}).statics({
    create: ({ ldap: { url, bind } }) => {
        const client = new Client({ url });

        const ConfiguredClient = LdapClient.conf({client}).compose(stampit.methods({
            rebind() {
                return this.bind(bind.dn, bind.pw);
            }
        }));

        const ClientInstance = ConfiguredClient();

        return ClientInstance.rebind().then(() => ClientInstance);
    }
});

export default LdapClient;
