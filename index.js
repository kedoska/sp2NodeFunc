const async = require('async')
const sql = require('mssql')
const fs = require('fs')
const types = require('./types.json')
const args = process.argv.slice(2)

const schema = args[0]
const filter = args[1]

if (!schema || !schema.length) {
  console.log(`
    call this program like this:
    node index.js dbo
       >> 'dbo' is the name of the "schema" you want to process

    node index.js dbo mngsp_%
       >> 'dbo' is the name of the "schema" you want to process
       >> 'mngsp_%' is the filter applied in like to the procedure name
    `)
  process.exit()
}

const executeQuery = (query) => {
  const request = new sql.Request()
  return request.query(query)
}

const getStoredProcedureListBySchema = () => {
  let query = `
  SELECT
      [schema] = OBJECT_SCHEMA_NAME([object_id]),
    [name]
  FROM sys.procedures
  WHERE OBJECT_SCHEMA_NAME([object_id]) = '${schema}'
  `
  if (filter) {
    query += `AND [NAME] like '${filter}'
    `
  }
  query += 'ORDER BY [NAME]'
  return executeQuery(query)
}

const getStoredProcedureSchema = (storedProcedureName, done) => {
  console.log(` >> processing ${storedProcedureName}`)
  const query = `
  SELECT
      'name' = [name],
      'type' = type_name(user_type_id),
      'Length' = max_length,
      'Prec' = CASE WHEN type_name(system_type_id) = 'uniqueidentifier'
        THEN precision
               ELSE OdbcPrec(system_type_id, max_length, precision) END,
      'Scale' = OdbcScale(system_type_id, scale),
      'Param_order' = parameter_id,
      is_output
  FROM sys.parameters
  WHERE object_id = object_id('${schema}.${storedProcedureName}')
  ORDER BY Param_order ASC
  `
  executeQuery(query)
    .then(result => {
      const text = buildScript(storedProcedureName, result)
      done(null, text)
    })
    .catch(err => {
      done(err, null)
    })
}

const buildScript = (storedProcedureName, params) => {
  const args = params.map(x => {
    const typeInfo = types[x.type]
    let finalType = 'sql.'
    switch (x.type.toLowerCase()) {
      case 'bit': {
        finalType += 'Bit'
        break
      }
      case 'bigint': {
        finalType += 'BigInt'
        break
      }
      case 'decimal': {
        finalType += `Decimal(${x.Prec}, ${x.Scale})`
        break
      }
      case 'float': {
        finalType += `Float`
        break
      }
      case 'int': {
        finalType += `Int`
        break
      }
      case 'money': {
        finalType += `Money`
        break
      }
      case 'numeric': {
        finalType += `Numeric(${x.Prec}, ${x.Scale})`
        break
      }
      case 'smallint': {
        finalType += `SmallInt`
        break
      }
      case 'smallmoney': {
        finalType += `SmallMoney`
        break
      }
      case 'real': {
        finalType += `Real`
        break
      }
      case 'tinyint': {
        finalType += `TinyInt`
        break
      }
      case 'char': {
        finalType += `Char(${x.Length})`
        break
      }
      case 'nchar': {
        finalType += `NChar(${x.Length})`
        break
      }
      case 'text': {
        finalType += `Text`
        break
      }
      case 'ntext': {
        finalType += `NText`
        break
      }
      case 'varchar': {
        finalType += `VarChar(${x.Length})`
        break
      }
      case 'nvarchar': {
        finalType += `NVarChar(${x.Length})`
        break
      }
      case 'xml': {
        finalType += `Xml`
        break
      }
      case 'time': {
        finalType += `Time(${x.Scale})`
        break
      }
      case 'datetime2': {
        finalType += `DateTime2(${x.Scale})`
        break
      }
      case 'datetimeoffset': {
        finalType += `DateTimeOffset(${x.Scale})`
        break
      }
      case 'date': {
        finalType += `Date`
        break
      }
      case 'datetime': {
        finalType += `DateTime`
        break
      }
      case 'smalldatetime': {
        finalType += `SmallDateTime`
        break
      }
      case 'uniqueidentifier': {
        finalType += `UniqueIdentifier`
        break
      }
      case 'variant': {
        finalType += `Variant`
        break
      }
      case 'binary': {
        finalType += `Binary`
        break
      }
      case 'varbinary': {
        finalType += `VarBinary(${x.Length})`
        break
      }
      case 'image': {
        finalType += `Image`
        break
      }
      case 'udt': {
        finalType += `UDT`
        break
      }
      case 'geography': {
        finalType += `Geography`
        break
      }
      case 'geometry': {
        finalType += `Geometry`
        break
      }
      default: {
        console.log(x)
        throw new Error('Type not implemented in buildScript Map')
      }
    }
    return {
      name: x.name.replace('@', '').toLowerCase(),
      type: typeInfo.type,
      asString: typeInfo.asString,
      originalType: x.type,
      finalType: finalType,
      output: x.is_output,
      len: x.Length,
      precision: x.Prec
    }
  })
  const outputParams = args.filter(x => x.output)
  const hasArgs = args.length > 0
  const comment = `
/**
 * @function ${storedProcedureName}
${args.map(x => {
  let info = ` * @param {${x.type}} ${x.name} - ${x.originalType} (len and precision: ${x.len}:${x.precision})`
  if (x.output) {
    info += ' OUTPUT'
  }
  return info
}).join('\n')}
 * @param done {function} callback(err, result${outputParams.length>0?', outputs':''})
 */`
  const body = `${comment}
module.exports.${schema}.${storedProcedureName} = (${args.map(x => x.name).join(', ')}${hasArgs ? ', ' : ''}done) => {
  const request = new sql.Request()
    ${args.filter(x => !x.output).map(x => {
      return `.input('${x.name}', ${x.finalType}, ${x.name})`
    }).join('\n    ')}
    ${outputParams.map(x => {
      return `.output('${x.name}', ${x.finalType}, ${x.name})`
    }).join('\n    ')}
  request.execute('${schema}.${storedProcedureName}')
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
}`
  return body.replace(/(^[ \t]*\n)/gm, '') + '\n'
}

sql.connect(require('./database.json')).then(() => {
  getStoredProcedureListBySchema(schema)
    .then(result => {
      const listOfProcedures = result.map(x => x.name)
      async.map(listOfProcedures, getStoredProcedureSchema, (err, results) => {
        if (err) {
          console.log(err)
          sql.close()
          return
        }
        sql.close()
        let file = `./exports/${schema}.js`
        if (filter) {
          file = `./exports/${schema}_${filter
            .replace('%', '')
            .replace('%', '')
            .replace('_', '')
          }.js`
        }
        const stream = fs.createWriteStream(file)
        stream.write('const sql = require(\'mssql\')\n')
        stream.write(`module.exports.${schema} = {}\n`)
        results.forEach(x => {
          stream.write(x)
        })
        stream.write('// End\n')
        stream.end()
      })
    })
    .catch(err => {
      console.log(err)
      sql.close()
    })
})
