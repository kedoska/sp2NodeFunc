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

<img src="https://cloud.githubusercontent.com/assets/11739105/20719998/b33d4f78-b62b-11e6-9e85-8732c09e7369.png" alt="example" />