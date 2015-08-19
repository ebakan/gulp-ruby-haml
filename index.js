var spawn = require('win-spawn');
var gutil = require('gulp-util');
var Buffer = require('buffer').Buffer;
var PluginError = gutil.PluginError;
var clone = require('clone');
var through = require('through2');

var PLUGIN_NAME = 'gulp-ruby-haml';

module.exports = function (opt) {
  'use strict';

  function modifyFile(file, enc, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      this.emit('error', new PluginError(PLUGIN_NAME,
                                         'Streaming not supported'));
      return callback(null, file);
    }

    opt = opt || {};
    var options = {};
    options.outExtension = opt.outExtension || '.html';
    options.doubleQuote = opt.doubleQuote || false;
    options.require = opt.require || false;
    options.executable = opt.executable || 'haml';

    var file_contents = file.contents.toString('utf8');
    var args = [options.executable];
    args.push('-s');
    if (options.doubleQuote) {
      args.push('-q');
    }
    if (options.require) {
      args.push('-r');
      args.push(options.require);
    }
    var cp = spawn(args.shift(), args);

    var self = this;
    cp.on('error', function (err) {
      self.emit('error', new PluginError(PLUGIN_NAME, err));
      return callback(null, file);
    });

    var haml_data = '';
    cp.stdout.on('data', function (data) { haml_data += data.toString(); });

    var errors = '';
    cp.stderr.setEncoding('utf8');
    cp.stderr.on('data', function (data) { errors += data.toString(); });

    cp.on('close', function (code) {
      if (errors) {
        self.emit('error', new PluginError(PLUGIN_NAME, errors));
        return callback(null, null);
      }

      if (code > 0) {
        self.emit('error', new PluginError(PLUGIN_NAME,
                                           'Exited with error code ' + code));
        return callback(null, null);
      }

      var newFile = clone(file);
      newFile.path = gutil.replaceExtension(file.path, options.outExtension);
      newFile.contents = new Buffer(haml_data);
      return callback(null, newFile);
    });

    cp.stdin.write(file_contents);
    cp.stdin.end();
  }

  return through.obj(modifyFile);
};
