ldap-client
===========

A LDAP client that allows you to use abstractions to access LDAP data.

Usage
-----

```javascript
import LdapClient from 'ldap-client';

const config = {
    ldap: {
        url: 'ldap://ldap.forumsys.com',
        bind: {
            dn: 'cn=read-only-admin,dc=example,dc=com',
            pw: 'password'
        }
    }
};

LdapClient.create(config).then(client => {
	// Register a *type* on the client
	client.register({
		name: { singular: 'user', plural: 'users' },
		base: 'ou=users,cn=example,cn=com',
		scope: 'one',
		filter: 'objectClass=inetOrgPerson',
		key_field: 'uid' // the field used in rdn of the tree
		attributes: [ 'uid', 'cn', 'sn', 'givenName', 'mail', 'memberOf' ] 
		// if attributes is not specified, all attributes (excluding system ones) are retrieved
	})
	
	// Retrieve a specific user
	client.get_user('tesla').then(user => console.log(user));
	
	// List all users
	client.all_users().then(users => console.log(users));
	
	// Update user's email address
	client.set_user('tesla', { mail: 'tesla@universe.com' }).then(() => console.log('User updated!');

	// Create new user
	client.set_user('tevaum', { 
		cn: 'Estêvão', sn: 'Procópio Amaral',
		givenName: 'Samuel',
		mail: 'tevaum@universe.com'
	}).then(() => console.log('User added!'));
});
```

Build from git:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Bug reports, feature requests and pull requests are appreciated!
