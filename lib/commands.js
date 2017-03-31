'use strict'

// natives
const path = require('path')

// packages
const moment = require('moment')
const jsonfile = require('jsonfile')
const Promise = require('bluebird')

// ours
const db = require('./db.js')
const helpers = require('./utils/helpers.js')
const spinner = require('./utils/spinner.js')

// constants
const TODAY = moment().format('YYYY-MM-DD')
const NOW = moment().format('HH:mm')
const CONFIG_FILE = path.join(__dirname, 'config.json')

// CONFIG has stuff that can be changed in runtime, so
const configLoaded = new Promise((resolve, reject) => {
  jsonfile.readFile(CONFIG_FILE, (err, obj) => {
    if (err) {
      reject(err)
    }
    resolve(obj)
  })
})

// constants has real un-changeable stuff, they are read-only
const constants = require('./constants.json')

// determine whether to setStart | setEnd | report
// based on entered information in database
const nextUndoneAction = (args, options, logger) => {
  db.getDateReport(TODAY, db.knex)
    .then((data) => {
      if (data && !data.start) {
        setStart(args, options, logger)
        return
      }
      if (data && !data.end) {
        setEnd(args, options, logger)
        return
      }
      if (data && data.start && data.end) {
        report(args, options, logger)
        return
      }

      // this one is for when we don't even have the database
      setStart(args, options, logger)
    })
}

const setStart = (args, options, logger) => {
  const start = args.start || NOW
  configLoaded
    .then((config) => {
      const payload = {
        date: TODAY,
        start,
        breakDuration: config.BREAK_DEFAULT,
        action: 'setStart'
      }

      // update database
      db.updateDatabase(payload, db.knex)
        .then(() => {
          spinner.succeed(`Your start of the day registered as ${start}\n\n`).start()
          helpers.shouldWorkUntil(start, config)
          spinner.info('TIP: next time you run moro the end of your day will be set\n')
        })
        .catch(spinner.fail)
        .finally(() => { process.exit(0) })
    })
    .catch(spinner.fail)
}

// set total duration of break for today
const setBreak = (args, options, logger) => {
  const duration = args.duration
  spinner.succeed(`Break took: ${duration} minutes and will be removed from your work hours\n`).start()

  const payload = {
    date: TODAY,
    breakDuration: duration,
    action: 'setBreakDuration'
  }
  db.updateDatabase(payload, db.knex)
    .catch(spinner.fail)
    .then(() => { report() })
}

// report functionality for both single and batch reporting
const report = (args, options, logger, date) => {
  date = date || TODAY
  configLoaded
    .then((config) => {
      if (options && options.all) {
        db
          .getFullReport(db.knex, config)
          .catch(spinner.fail)
          .finally(() => { process.exit(0) })
        return
      }
      db
        .calculateWorkHours(date, db.knex)
        .then((result) => {
          db.getDateReport(TODAY, db.knex)
            .then((data) => {
              if (data && result) {
                data.dayReport = helpers.formatWorkHours(result.workHours)
                const table = helpers.printSingleDayReport(data)
                spinner.info('Today looks like this so far:\n')

                // renders the table
                console.log(table)

                spinner.info('Run moro --help if you need to edit your start, end or break duration for today\n')
                process.exit(0)
              }
            })
            .catch(spinner.fail)
        })
        .catch(spinner.fail)
    })
}

// set the configuration in the config file
const setConfig = (args, options, logger) => {
  configLoaded
    .then((config) => {
      if (options.day) {
        config.HOURS_IN_A_WORK_DAY = options.day
        console.log('\n \n ✔ Duration of full work day is set to ', options.day)
      }
      if (options.break) {
        config.BREAK_DEFAULT = options.break
        console.log('\n \n ✔ Default break duration is set to', options.break)
      }
      if (options.format) {
        config.DATE_FORMAT = options.format
        console.log('✔ Default date format pattern is set to', options.format)
      }
      // check, if value is set ('' is falsy but denotes default path)
      if (options.databasePath && options.databasePath.hasOwnProperty('value')) {
        config.DB_FILE_MAIN = options.databasePath.value
        // make sure the correct result is logged
        const dbPath = options.databasePath.value !== ''
          ? options.databasePath.value
          : 'default'
        console.log('✔ Default database path is set to', dbPath)
      }
      jsonfile.writeFileSync(CONFIG_FILE, config)
    })
    .catch(spinner.fail)
    .finally(() => process.exit(0))
}

// set end of the work day
const setEnd = (args, options, logger) => {
  const end = args.end || NOW
  spinner.succeed(`Your end of the work day is set at: ${end}\n`)

  const payload = {
    date: TODAY,
    end,
    action: 'setEnd'
  }
  db
    .updateDatabase(payload, db.knex)
    .then(() => { report() })
}

const clearData = (args, options, logger, spinner) => {
  if (options && options.yes) {
    return db.removeDatabase()
  }
  logger.info(' \n \n [BE CAREFUL] If you surely want to clear all data in moro run: moro clear --yes')
  process.exit()
}

const addNote = (args, options, logger) => {
  let note = args.note || '...'
  note = note.join(' ')
  const createdat = NOW
  const payload = {
    date: TODAY,
    note,
    createdat,
    action: 'addNote'
  }
  db.updateDatabase(payload, db.knex)
    .then(() => report())
    .catch(spinner.fail)
    .finally(() => {
      console.log('\n \n ✔ Your note is added! You can see it in report \\O/ ')
    })
}

const about = (args, options, logger) => {
  spinner.stopAndPersist().start()
  spinner.info(constants.TEXT.about)
  process.exit()
}

module.exports = {
  nextUndoneAction,
  setConfig,
  setEnd,
  setStart,
  setBreak,
  addNote,
  report,
  clearData,
  about
}
