'use strict';
/*
 * Attention: let's add end-to-end tests instead of this!
 * Check ./end-to-end/moro.tests.bats
 *
 */
import test from 'ava';
import {
  printSingleDayReport,
  printAllDaysReport,
  printSearchResults,
} from '../lib/utils/helpers.js';

const moment = require('moment');

const diff = (start, end) => {
  return moment.duration(moment(end).diff(moment(start)));
};

test('singleDayReport runs without crashing', (t) => {
  const sampleDayRecord = {
    id: 1,
    date: '2017-03-10',
    start: '05:15',
    end: '05:15',
    breakDuration: 30,
    notes: [{ id: 1, date: '2017-03-10', createdat: '06:29', note: 'hello' }],
    dayReport: '0 Hours and -30 Minutes',
  };
  t.pass(printSingleDayReport(sampleDayRecord));
});

test('printAllDaysReport runs without crashing', (t) => {
  const reprotRecord = [
    {
      date: '2017-03-10',
      workHours: diff('2017-03-10 09:15', '2017-03-10 17:10'),
    },
  ];
  t.pass(printAllDaysReport(reprotRecord));
});

test('printAllDaysReport with week change runs without crashing', (t) => {
  const reprotRecord = [
    { date: '2017-03-09', workHours: diff('2017-03-09 09:15', '2017-03-09 17:10') },
    { date: '2017-03-10', workHours: diff('2017-03-10 09:15', '2017-03-10 17:10') },
    { date: '2017-03-14', workHours: diff('2017-03-14 09:10', '2017-03-14 17:10') },
    { date: '2017-03-15', workHours: diff('2017-03-15 09:10', '2017-03-15 17:10') },
  ];
  t.pass(printAllDaysReport(reprotRecord));
});

test('printSearchResults runs without crashing', (t) => {
  const searchResults = [
    { date: '2017-08-04', createdat: '17:00', note: '#Workrelated' },
    { date: '2017-08-04', createdat: '17:30', note: '#Workrelated' },
    { date: '2017-08-04', createdat: '18:00', note: 'Other project #related' },
  ];
  t.pass(printSearchResults(searchResults));
});
