const generators = require('yeoman-generator')
const path       = require('path')
const camelize   = require('camelize')
const compact    = require('lodash.compact')
const assign     = require('lodash.assign')
const prefixnote = require('prefixnote')
const chalk      = require('chalk')
const striate    = require('gulp-striate')
const pkg        = require('../package.json')

// if the package name is generator-yogini then we are in creation mode
// which will recursively copy this generator itself and give it a new
// project name so that subsequent runs will generate from app/templates
const createMode = pkg.name === 'generator-yogini'

// prettifies a string of keywords to display each one on a separate line with correct indentation in the package.json
function prettyKeywords(keywords) {

  // convert the keywords string into an array
  keywordArray = compact( // remove empty values
    keywords.split(',')
    .map(function(s) { return s.trim() }) // trim
  );

  // prettify the keywordArray to display each one on a separate line with correct indentation in the package.json
  return JSON.stringify(keywordArray)
    .replace(/([[,])/g, '$1\n    ') // add '    \n' after each item
    .replace(/]/g, '\n  ]') // add a newline before the closing ]
}

module.exports = generators.Base.extend({

  constructor: function () {

    generators.Base.apply(this, arguments)

    // parse yogini.json and report error messages for missing/invalid
    try {
      this.yoginiFile = require(createMode ? '../create/yogini.json' : './yogini.json')
    }
    catch(e) {
      if(e.code === 'MODULE_NOT_FOUND') {
        console.log(chalk.red('No yogini.json found. Proceeding with simple copy.'))
      }
      else {
        console.log(chalk.red('Invalid yogini.json'))
        console.log(chalk.red(e))
      }
    }

    // this.viewData is passed to copyTpl
    // it is populated with the prompt results during prompting()
    this.viewData = {
      camelize
    }

  },

  prompting: function () {

    const done = this.async();

    if(this.yoginiFile && !(this.yoginiFile.prompts && this.yoginiFile.prompts.length)) {
      console.log(chalk.red('No prompts in yogini.json. Proceeding with simple copy.'))
      return
    }

    this.prompt(this.yoginiFile.prompts, function (props) {

      // disallow a project name of generator-yogini
      if(createMode && props.name === 'generator-yogini') {
        const error = 'You may not name your generator "generator-yogini".'
        this.log.error(error)
        done(error)
        return
      }

      // add prompt results to the viewData
      assign(this.viewData, props)

      // format keywords
      this.viewData.keywordsFormatted = props.keywords ? prettyKeywords(props.keywords) : null

      done()
    }.bind(this))
  },

  // Copies all files from the template directory to the destination path
  // parsing filenames using prefixnote and running them through striate
  writing: function () {

    const done = this.async();

    if(createMode) {

      // copy yogini-generator itself
      this.fs.copy(path.join(__dirname, '../'), this.destinationPath(), {
        globOptions: {
          dot: true,
          ignore: [
            '**/.git',
            '**/.git/**/*',
            '**/node_modules',
            '**/node_modules/**/*',
            '**/create/**/*'
          ]
        }
      })

      // copy the package.json
      this.fs.copyTpl(path.join(__dirname, '../create/{}package.json'), this.destinationPath('package.json'), this.viewData)

      done()
    }
    else {
      this.registerTransformStream(striate(this.viewData))

      prefixnote.parseFiles(this.templatePath(), this.viewData)
        .on('data', function (file) {
          const from = file.original
          const to = this.destinationPath(path.relative(this.templatePath(), file.parsed))
          console.log(from, to)
          this.fs.copyTpl(from, to, this.viewData)
        }.bind(this))
        .on('end', done)
        .on('error', done)
    }
  },

  end: function () {
    this.installDependencies()
  }

})
