'use strict'

// native
const path = require('path')
const fs = require('mz/fs')

// packages
const osHomedir = require('os-homedir')
const jsonfile = require('jsonfile')

// ours
// constants
const constants = require('./constants.json')
const helpers = require('./utils/helpers.js')
const spinner = require('./utils/spinner.js')
const CONFIG_FILE = path.join(__dirname, 'config.json')

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("Config file couldn't be found")
  process.exit(1)
}

// determine path to database file
const configPath = jsonfile.readFileSync(CONFIG_FILE).DB_FILE_MAIN
const defaultPath = path.join(osHomedir(), constants.DB_FILE_MAIN)
const dbTestFile = path.join(__dirname, '..', 'tests', constants.DB_FILE_FOR_TESTS)
const isTestMode = process.env.MORO_TEST_MODE === 'true'

const dbFile = isTestMode
  ? dbTestFile
  : configPath === '' ? defaultPath : configPath

// log info about test mode
const logTestMode = () => {
  if (isTestMode) {
    console.log('[info] moro running in test mode, a temporary db will be used')
  }
}

// use a temporary db if in test mode
logTestMode()

const knex = require('knex')({
  dialect: 'sqlite3',
  connection: {
    filename: dbFile
  },
  useNullAsDefault: true
})

const removeDatabase = () => {
  logTestMode()

  return fs.exists(dbFile)
    .then((exists) => {
      if (!exists) {
        console.log('database file did not exist nothing to remove')
        process.exit(0)
        return
      }

      return fs.unlink(dbFile)
        .then(() => {
          console.log('database file deleted successfully')
        })
        .catch((e) => {
          console.log('Run: moro report --all to make sure data is cleared', e)
        })
        .finally(() => {
          process.exit(0)
        })
    })
    .catch(spinner.fail)
}

// Create a table
const createTable = (knex) => (
  knex.schema.createTableIfNotExists('records', (table) => {
    table.increments('id')
    table.date('date')
    table.time('start')
    table.time('end')
    table.integer('breakDuration')
  })
  .createTableIfNotExists('notes', (table) => {
    table.increments('id')
    table.date('date')
    table.string('createdat')
    table.text('note')
  })
  .catch((e) => console.log('Errors in createTable', e))
// input is an object,  {date, start[optional], end[optional], breakDuration, action}
)

const updateDatabase = (options, knex) => {
  const date = options.date
  const start = options.start
  const end = options.end
  const breakDuration = options.breakDuration
  const action = options.action
  const note = options.note
  const createdat = options.createdat

  return createTable(knex)
    .then(() => {
      return knex
        .select('*')
        .from('records')
        .where({date})
    })
    .then((row) => {
      // date is there, update the row
      if (row.length === 1) {
        switch (action) {
          case 'setStart':
            return knex('records').update({start}).where({date})
          case 'setEnd':
            return knex('records').update({end}).where({date})
          case 'setBreakDuration':
            return knex('records').update({breakDuration}).where({date})
          case 'addNote':
            return knex.insert({date, note, createdat}).into('notes')
        }
      } else {
        // date doesn't exist, insert it
        return knex.insert({date, start, end, breakDuration}).into('records')
      }
    })
    .catch(spinner.fail)
}

// gets data for a single day
const getDateReport = (date, knex) => (
  // Then query the table...
  createTable(knex)
  .then(() => {
    return knex
      .select('*')
      .from('records')
      .where({date})
  })
  .then((row) => {
    return knex
      .select('*')
      .from('notes')
      .where({date})
      .then((notes) => {
        if (row[0]) {
          row[0].notes = notes
        }
        return row[0]
      })
  })
  .catch(spinner.fail)
)

// if start / end is not yet marked, yell at the user
const getUndoneWarnings = (dayRecord) => {
  if (!dayRecord || !dayRecord.start) {
    return 'Start of your work day is not marked yet! run moro to set it. Start needs to be set before I can give you the report'
  }
  return undefined
}
const calculateWorkHours = (date, knex) => (
  getDateReport(date, knex)
  .then((data) => {
    if (getUndoneWarnings(data)) {
      console.log(getUndoneWarnings(data))
      process.exit(0)
    }
    // console.log('data is: ', data)
    const getBreak = (data) => data.breakDuration
    const notes = data.notes

    const workHours = helpers.calculateWorkHours(data.start, data.end, getBreak(data))

    return { date, workHours, notes }
  })
  .catch(spinner.fail)
)

const getFullReport = (knex, CONFIG) => {
  CONFIG = CONFIG || {}
  return createTable(knex)
    .then(() => {
      return knex.select('date')
        .from('records')
        .whereNotNull('start')
        .whereNotNull('end')
        .map((row) => calculateWorkHours(row.date, knex))
        .then((results) => {
          helpers.printAllDaysReport(results, CONFIG)
          return (results)
        })
        .catch(spinner.fail)
    })
    .catch(spinner.fail)
}

module.exports = {
  dbTestFile,
  createTable,
  getDateReport,
  updateDatabase,
  calculateWorkHours,
  getFullReport,
  removeDatabase,
  knex
}
