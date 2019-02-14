import stampit from '@stamp/it';
import ldapjs from 'ldapjs';
import escape from 'ldap-escape';

import jws from 'jsonwebtoken';

const LdapClient = stampit.init(function LdapClient({ldap}, { stamp }) {
    let client = null;

    if (stamp.compose.configuration && stamp.compose.configuration.client)
        client = stamp.compose.configuration.client;
    else {
        client = ldapjs.createClient({ url: ldap.url });

        client.bind(ldap.bind.dn, ldap.bind.pw, (err) => {
            if (err) throw err;
        });
    }

    const type_cache = {};

    this.search = (base, opts) => {
        // if (opts.filter) opts.filter = escape.filter`${opts.filter}`;

        const result = [];
        return new Promise((resolve, reject) => {
            client.search(base, opts, (err, response) => {
                if (err) {
                    reject(err);
                    return;
                }

                response.on('searchEntry', entry => result.push(entry.object));
                response.on('error', ierr => reject(ierr));
                response.on('end', () => resolve(result));
            });
        });
    };

    this.bind = (dn, password) => new Promise((resolve, reject) => {
        client.bind(dn, password, err => {
            if (err)
		err.name == 'InvalidCredentialsError' ? resolve(false) : reject(err);
            else
		client.bind(ldap.bind.dn, ldap.bind.pw, () => resolve(true));
        });
    });

    this.add = ({ attrs, meta: { rdn, base } }) => new Promise((resolve, reject) => {
        if (!rdn) throw new Error('You must inform "meta.rdn" to add an entry to the ldap server');
        if (!attrs.objectClass) throw new Error('Your object must contain "objectClass" to add an entry to the ldap server');

        const dn = /*escape.dn*/`${rdn}=${attrs[rdn]},${base}`;

        client.add(dn, attrs, err => err ? reject(err) : resolve());
    });

    this.get = (dn, {attributes = '*'}={}) => {
        let parts = dn.split(',');
        let filter = parts.shift();
        let base = parts.join(',');

        return this.search(base, {scope: 'one', filter, attributes}).then(data => data.shift());
    };

    this.register = ({ name, base, scope, filter, attributes, key_field }) => {
        const all = `all_${name.plural}`;
        const one = `get_${name.singular}`;
        const add = `add_${name.singular}`;
        const set = `set_${name.singular}`;

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

        this[set] = (id, attributes) => new Promise((resolve, reject) => {
            const dn = id.indexOf(base) > -1 ? id : `${key_field}=${id},${base}`;
            const change = new ldapjs.Change({
                operation: 'replace',
                modification: attributes
            });

            client.modify(dn, change, err => err ? reject(err) : resolve());
        });
};

    this.disconnect = () => client.destroy();
}).statics({
    create: ({ ldap: { url, bind } }) => new Promise((resolve, reject) => {
        const client = ldapjs.createClient({ url });

        const ConfiguredClient = LdapClient.conf({client});

        const ClientInstance = ConfiguredClient();
        ClientInstance.bind(bind.dn, bind.pw)
            .then(() => resolve(ClientInstance))
            .catch(reject);
    })
});

export default LdapClient;
