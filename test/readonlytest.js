const assert = require('assert');

const LdapClient = require('../dist').default;

const options = {
    db: {
    },
    api: {
    },
    ldap: {
        url: 'ldap://ldap.forumsys.com',
        bind: {
            dn: 'cn=read-only-admin,dc=example,dc=com',
            pw: 'password'
        }
    }
};


describe('Testing LdapClient with ldap.forumsys.com', () => {
    let client = null;
    before(() => LdapClient.create(options).then(c => client = c));
    after(() => client.disconnect());

    it('Should get an account by dn', () => client
       .get('uid=tesla,dc=example,dc=com')
       .then(user => assert.deepStrictEqual(user, {
	   dn: 'uid=tesla,dc=example,dc=com',
	   uid: 'tesla',
	   sn: 'Tesla',
	   cn: 'Nikola Tesla',
	   mail: 'tesla@ldap.forumsys.com',
	   uidNumber: '88888',
	   gidNumber: '99999',
	   homeDirectory: 'home',
	   objectClass: [ 'inetOrgPerson', 'organizationalPerson', 'person', 'top', 'posixAccount' ]
       })));

    it('Should directly search a scientist by uid', () => {
	return client
	    .search('dc=example,dc=com', {
		scope: 'sub',
		filter: 'uid=einstein'
	    })
	    .then(result => {
		let user = result.shift();
		assert.deepStrictEqual(user, {
		    dn: 'uid=einstein,dc=example,dc=com',
		    objectClass: [ 'inetOrgPerson', 'organizationalPerson', 'person', 'top' ],
		    cn: 'Albert Einstein',
		    sn: 'Einstein',
		    uid: 'einstein',
		    mail: 'einstein@ldap.forumsys.com',
		    telephoneNumber: '314-159-2653'
		});
	    });
    });

    it('Should register an account type', () => {
        let GroupType = {
            name: { singular: 'account', plural: 'accounts' },
            base: 'dc=example,dc=com',
            scope: 'one',
            filter: 'objectClass=inetOrgPerson',
            key_field: 'uid'
        };

        client.register(GroupType);
        assert.equal(typeof client.all_accounts, 'function');
        assert.equal(typeof client.get_account, 'function');
        assert.equal(typeof client.add_account, 'function');
        assert.equal(typeof client.set_account, 'function');
        assert.equal(typeof client.find_accounts, 'function');
    });

    it('Should get an account by uidNumber', () => client
       .find_accounts({ uidNumber: 88888, gidNumber: 99999 })
       .then(user => assert.deepStrictEqual(user, [{
	   dn: 'uid=tesla,dc=example,dc=com',
	   uid: 'tesla',
	   sn: 'Tesla',
	   cn: 'Nikola Tesla',
	   mail: 'tesla@ldap.forumsys.com',
	   uidNumber: '88888',
	   gidNumber: '99999',
	   homeDirectory: 'home',
	   objectClass: [ 'inetOrgPerson', 'organizationalPerson', 'person', 'top', 'posixAccount' ]
       }])));

    it('Should get tesla info', () => client.get_account('tesla').then(account => assert.equal(account.uid, 'tesla')));

    it('Should list all accounts', async () => {
	let accounts = await client.all_accounts();
	assert.equal(accounts.length, 17);
    });

    it('Should retrieve tesla from cache', () => client
       .find_accounts({ uidNumber: 88888, gidNumber: 99999 })
       .then(user => assert.deepStrictEqual(user, [{
	   dn: 'uid=tesla,dc=example,dc=com',
	   uid: 'tesla',
	   sn: 'Tesla',
	   cn: 'Nikola Tesla',
	   mail: 'tesla@ldap.forumsys.com',
	   uidNumber: '88888',
	   gidNumber: '99999',
	   homeDirectory: 'home',
	   objectClass: [ 'inetOrgPerson', 'organizationalPerson', 'person', 'top', 'posixAccount' ]
       }])));

    it('Should get riemann info', () => client
       .get_account('riemann')
       .then(mathpro => assert.deepStrictEqual(mathpro, {
           cn: 'Bernhard Riemann',
	   sn: 'Riemann',
	   uid: 'riemann',
           dn: 'uid=riemann,dc=example,dc=com',
           mail: 'riemann@ldap.forumsys.com',
           objectClass: [
               'inetOrgPerson',
               'organizationalPerson',
	       'person',
	       'top'
           ]
       })));

    it('Should try to change riemann email', () => client
       .set_account('riemann', { mail: 'riemann@welovemaths.com' })
       .catch(err => {
	   assert.equal(err.name, 'Error');
	   assert.equal(err.code, 0x32);
	   assert.equal(err.message, 'The caller does not have sufficient rights to perform the requested operation. Code: 0x32');
       }))

    it('Should try to add a new user', () => client
       .add_account('estevao', { cn: 'Estêvão', sn: 'Amaral', mail: 'estevao@ldap.forumsys.com', objectClass: [ 'inetOrgPerson' ] })
       .catch(err => {
	   assert.equal(err.name, 'Error');
	   assert.equal(err.code, 0x32);
	   assert.equal(err.message, 'The caller does not have sufficient rights to perform the requested operation. Code: 0x32');
       }))

    it('Should try to bind witn an invalid user', () => client.bind('uid=estevao,dc=example,dc=org', 'password')
       .catch(err => {
	   assert.equal(err.name, 'Error');
	   assert.equal(err.code, 0x31);
	   assert.equal(err.message, 'Invalid credentials during a bind operation. Code: 0x31');
       }));

    it('Should get all accounts from cache', () => client.all_accounts().then(accounts => assert.equal(accounts.length, 17)));

});
