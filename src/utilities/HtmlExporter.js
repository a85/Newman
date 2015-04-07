var jsface       = require('jsface'),
	Globals      = require('./Globals'),
	log          = require('./Logger'),
	fs           = require('fs');

/**
 * @class HtmlExporter
 * @classdesc Class Used to generate pretty html reports
 */
var HtmlExporter = jsface.Class({
	$singleton: true,
	templates: null,
	generateHTMLOld: function(resultObj) {
		var template;
		//Always use existing file
		template = require('../templates/html/htmlResponseTemplate');
		var htmlPath = Globals.html;
		try {
			fs.writeFileSync(htmlPath, template(resultObj));
		}
		catch(e) {
			log.error("Error writing to file. Try using sudo. Error: " + e);
		}
		log.note("\nHTML Report written to: " + htmlPath+"\n");
	},
	generateHTMLNew: function(resultObj) {
		var template = require('../templates/html2/htmlResponseTemplate');
		var htmlPath = Globals.html2;
		try {
			fs.writeFileSync(htmlPath, template(resultObj));
		}
		catch(e) {
			log.error("Error writing to file. Try using sudo. Error: " + e);
		}
		log.note("\nHTML Report written to: " + htmlPath+"\n");
	}
});

module.exports = HtmlExporter;
