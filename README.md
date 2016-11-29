sp2NodeFunc
===========

Parser to map MSSQL Stored Procedure into Javascript functions (using [node-mssql](http://patriksimek.github.io/node-mssql/))

### Setup
You need to edit the `database.json` in order to connect your MS SQL instance.

### Input
any valid sql schema having Store Procedures. It will search into your DB using the following query:

```
  SELECT
    [schema] = OBJECT_SCHEMA_NAME([object_id]),
    [name]
  FROM sys.procedures
  WHERE OBJECT_SCHEMA_NAME([object_id]) = '${schema}'
```

To pass the schema name you can use the following inputs in command line:

```
    node index.js dbo
       >> 'dbo' is the name of the "schema" you want to process

    node index.js dbo mngsp_%
       >> 'dbo' is the name of the "schema" you want to process
       >> 'mngsp_%' is the filter applied in like to the procedure name
```

### Output

Assuming your schema has some Stored Procedures, it will generates a module exporting one function per procedure. As an example, consider this output:

In this case we are generating a function 
1. accepting all the parameters specified in the SP
2. considering IN and OUT params
3. returning `recordsets` as a second callback param
4. returning `outputs` as a third callback param

```
const sql = require('mssql')
module.exports.dbo = {}
/**
 * @function sp_GetCustomer
 * @param {String} user - varchar (len and precision: 100:100)
 * @param {String} password - varchar (len and precision: 100:100)
 * @param {Number} customer - int (len and precision: 4:10) OUTPUT
 * @param {Number} profile - int (len and precision: 4:10) OUTPUT
 * @param {Number} session - int (len and precision: 4:10) OUTPUT
 * @param done {function} callback(err, result, outputs)
 */
module.exports.dbo.sp_GetCustomer = (user, password, customer, profile, session, casino, done) => {
  const request = new sql.Request()
    .input('user', sql.VarChar(100), user)
    .input('password', sql.VarChar(100), password)
    .output('customer', sql.Int, customer)
    .output('profile', sql.Int, profile)
    .output('session', sql.Int, session)
  request.execute('dbo.sp_GetCustomer')
    .then(x => {
      const outputs = Object.keys(request.parameters).map(x => {
        const param = {}
        param[request.parameters[x].name] = request.parameters[x].value
        return param
      })
      done(null, x, outputs)
    })
    .catch(err => {
      done(err, null)
    })
}
```