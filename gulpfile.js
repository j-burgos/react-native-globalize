/*!
 * React Native Globalize
 *
 * Copyright 2015-2016 Josh Swan
 * Released under the MIT license
 * https://github.com/joshswan/react-native-globalize/blob/master/LICENSE
 */
'use strict';

const gulp = require('gulp');
const babel = require('gulp-babel');
const filter = require('gulp-filter');
const merge = require('gulp-merge-json');
const mergeStream = require('merge-stream');
const path = require('path');
const Cldr = require('cldrjs');

const locales = [
  'en',           // English
  'en-GB',        // English (Great Britain)
  'en-US-POSIX',  // English (United States)
  'es',           // Spanish
  'es-419',       // Spanish (Latin America & Caribbean)
];

const currencies = [
  'CAD',          // Canadian Dollar
  'EUR',          // Euro
  'GBP',          // British Pound
  'USD',          // US Dollar
];

const files = ['ca-gregorian', 'currencies', 'dateFields', 'numbers', 'timeZoneNames'];
const supplemental = ['currencyData', 'likelySubtags', 'numberingSystems', 'ordinals', 'plurals', 'timeData', 'weekData'];
const cldrs = locales.map((x) => new Cldr(x));
const languages = cldrs.map((x) => x.attributes.language);

gulp.task('build', function() {
  const js = gulp.src(['src/*.js', 'src/**/*.js'])
    .pipe(babel())
    .pipe(gulp.dest('lib'));

  const json = gulp.src(['src/*.json'])
    .pipe(gulp.dest('lib'));

  return mergeStream(js, json);
});

function removeUnusedLanguages(dict) {
  if (dict) {
    Object.keys(dict).forEach(function(key) {
      if (languages.indexOf(key) === -1) {
        delete dict[key];
      }
    });
  }
}

gulp.task('cldr', function() {
  const cldrFilter = filter(function(file) {
    return (locales.indexOf(path.dirname(file.path).split(path.sep).pop()) > -1 && files.indexOf(path.basename(file.path, '.json')) > -1) || (path.dirname(file.path).split(path.sep).pop() === 'supplemental' && supplemental.indexOf(path.basename(file.path, '.json')) > -1);
  });

  return gulp.src(['./node_modules/cldr-data/supplemental/*.json', './node_modules/cldr-data/main/**/*.json'])
    .pipe(cldrFilter)
    .pipe(merge('cldr.json', function(obj) {
      if (obj.main && obj.main['en-US-POSIX']) {
        obj.main['en-US'] = obj.main['en-US-POSIX'];
        delete obj.main['en-US-POSIX'];
        delete obj.main['en-US'].identity.variant;

        // Fix for en-US currency formatting
        if (obj.main['en-US'].numbers && obj.main['en-US'].numbers['currencyFormats-numberSystem-latn']) {
          obj.main['en-US'].numbers['currencyFormats-numberSystem-latn'].standard = '¤#,##0.00';
        }
      }

      if (obj.main) {
        // For language files, grab the first language, and filter stuff out
        let key = Object.keys(obj.main)[0];
        let data = obj.main[key];

        // Cut out unused dates.timeZoneNames.zone and dates.timeZoneNames.metazone data
        if (data && data.dates && data.dates.timeZoneNames) {
          data.dates.timeZoneNames.zone = {};
          data.dates.timeZoneNames.metazone = {};
        }

        // Only include above currencies in each language
        if (data && data.numbers && data.numbers.currencies) {
          const codes = Object.keys(data.numbers.currencies);

          for (let i = 0, l = codes.length; i < l; i++) {
            if (currencies.indexOf(codes[i]) === -1) {
              delete data.numbers.currencies[codes[i]];
            }
          }
        }
      }

      // Cut out unused languages from our supplemental files
      if (obj.supplemental) {
        const languageDictKeys = ['plurals-type-ordinal', 'plurals-type-cardinal'];
        for (let i = 0, l = languageDictKeys.length; i < l; i++) {
          removeUnusedLanguages(obj.supplemental[languageDictKeys[i]]);
        }

        // Only include currencies above
        if (obj.supplemental.currencyData) {
          delete obj.supplemental.currencyData.region;

          let codes = Object.keys(obj.supplemental.currencyData.fractions);

          for (let i = 0, l = codes.length; i < l; i++) {
            if (currencies.indexOf(codes[i]) === -1 && codes[i].toLowerCase() !== 'default') {
              delete obj.supplemental.currencyData.fractions[codes[i]];
            }
          }
        }
      }

      return obj;
    }))
    .pipe(gulp.dest('src'));
});

gulp.task('default', ['build']);
