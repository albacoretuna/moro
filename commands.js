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
          logger.info('\n ✔ Your start of the day registered as ', start)
          helpers.shouldWorkUntil(start, logger, config)
          logger.info('\n TIP: next time you run moro the end of your day will be set')
        })
        .catch((err) => { logger.error(err) })
        .finally(() => { process.exit(0) })
    })
    .catch((e) => console.log)
}

// set total duration of break for today
const setBreak = (args, options, logger) => {
  const duration = args.duration
  logger.info('✔ Break took: ', duration, 'Minutes', ' And will be removed from your work hours')

  const payload = {
    date: TODAY,
    breakDuration: duration,
    action: 'setBreakDuration'
  }
  db.updateDatabase(payload, db.knex)
    .catch((err) => { logger.error(err) })
    .then(() => { report() })
}

// report functionality for both single and batch reporting
const report = (args, options, logger, date) => {
  logger = logger || console.log
  date = date || TODAY

  if (options && options.all) {
    db
      .getFullReport(db.knex)
      .catch((error) => { console.log(error) })
      .finally(() => { process.exit(0) })

    return
  }
  db
    .calculateWorkHours(date, db.knex)
    .then((result) => {
      db.getDateReport(TODAY, db.knex)
        .then((data) => {
          if (data && result) {
            data.dayReport = result.formattedWorkHours
            const table = helpers.printSingleDayReport(data)
            console.log('\n Today looks like this so far:\n')
            // renders the table
            console.log(table)
            console.log('Run moro --help if you need to edit your start, end or break duration for today \n')
            process.exit(0)
          }
        })
        .catch((err) => { logger.error(err) })
    })
    .catch((err) => { logger.error(err) })
}
const setConfig = (args, options, logger) => {
  configLoaded
    .then((config) => {
      if (options.day) {
        config.HOURS_IN_A_WORK_DAY = options.day
        console.log('\n ✔ Duration of full work day is set to ', options.day)
      }
      if (options.break) {
        config.BREAK_DEFAULT = options.break
        console.log('\n ✔ Default break duration is set to', options.break)
      }
      jsonfile.writeFileSync(CONFIG_FILE, config)
    })
    .catch((e) => console.log)
    .finally(() => {
      process.exit(0)
    })
}
// set end of the work day
const setEnd = (args, options, logger) => {
  const end = args.end || NOW
  logger.info('✔ Your end of the work day is set at: ', end)

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
    db.removeDatabase(constants.DB_FILE_MAIN)
    spinner.text = 'ok'
    spinner.succeed()
    return
  }
  logger.info('If you surely want to clear all data in moro run: moro clear --yes')
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
    .then(() => {
      report()
    })
    .catch((err) => { logger.error(err) })
    .finally(() => {
      console.log('✔ Your note is added! You can see it in report \\O/ ')
    })
}

const about = (args, options, logger) => {
  console.log(constants.TEXT.about)
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
