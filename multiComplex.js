/**
 * The multiComplex module takes data specified in either config.googleSpreadSheet or config.csvFile and renders it via SVG and the the d3 library to the selector specified in config.selector
 * <br/><br/>The Data should have at least the below form
 * <table>
 * <tr><th>Protein A</th><th>Protein B</th><th>Order</th></tr>
 * <tr><th>P1</th><th>P2</th><th>1</th></tr>
 * <tr><th>P1</th><th>P3</th><th>2</th></tr>
 * <tr><th>P1</th><th>P4</th><th>3</th></tr>
 * <tr><th>P2</th><th>P3</th><th>3</th></tr>
 * </table><br/>
 * Where each row represents an interaction event between 2 proteins<br/>
 * <li>The "Protein A" (config.proteinAColumn) column should contain the name of one of the proteins involved in the interaction event.</li>
 * <li>The "Protein B" (config.proteinBColumn)column should contain the name of the other protein involved in the interaction event.</li>
 * <li>The "Order" (config.eventOrderColumn)column should specify the order in which the interaction events occur in contiguous incrementing integers starting from 1</li>
 * @example
 * muliComplex.config.googleSpreadSheet = "https://docs.google.com/spreadsheets/d/1mlnSovT52sNoAtfnB44wFqecsVE-U3M4dNAPVO9ZQws/pubhtml";
 * muliComplex.config.selector = "#mySelector";
 * multiComplex.draw();
 * @module multiComplex
 * @requires d3.js
 * @requires tabletop.js
 */
var multiComplex = function () {

var exports = {};
/**
 * configuration settings to determine how the module will load event data and render tracks
 * @property {url} googleSpreadSheet - published googleSpreadSheet link.
 * <br/>multiComplex will preferrentially load data from googleSpreadSheet
 * but if none is listed will use csvFile
 * @property {filePath} csvFile - local .csv file to load data from
 * @property {string} eventOrderColumn - column name for the "order" data in the file to be loaded
 * @property {string} proteinAColumn - column name for the first protein in an interaction in the file to be loaded
 * @property {string} proteinBColumn - column name for the second protein in an interaction in the file to be loaded
 * @property {decimal} screenProportion - sets maximum proportion of a widow diemsion the canvas can take up, can be >0 and <= 1 eg 0.5 would take up at most half width and half height
 * @property {decimal} xRatio - ratio of x dimension of canvas to screenProportion Width, can be >0 and <= 1
 * @property {decimal} yRatio - ratio of y dimension of canvas to screenProportion Height, can be >0 and <= 1
 * @property {number} outerWidth - canvas width in px. Used to overRide the setting made by xRatio if a set canvas width is desired
 * @property {number} outerHeight - canvas height in px. used to overRide the setting made by yRatio if a set canvas height is desired
 * @property {string} selector - used to specified the DOM element that the SVG canvas will be appended to
 */
exports.config = {
        googleSpreadSheet:"",
        csvFile: "",
        eventOrderColumn: "Order",
        proteinAColumn: "Protein A",
        proteinBColumn: "Protein B",
        screenProportion: 0.7,
        xRatio: null,
        yRatio: null,
        outerWidth: null,
        outerHeight: null,
        useURLConfig: false,
        selector: "body"
    };

/**
 * Triggers loading and processing data, generating settings from config and rendering data
 */
exports.draw = function () {
        if (config.useURLConfig) {
            setConfigFromURL();
        }
        loadData();
    };

 /**
  * internal settings generated from the config
  * @param {number} maxTrackNameLength the number of characters in the track with the longest trackName (primary protein name)
  * @param {number} outerWidth canvas width in px
  * @param {number} outerHeight canvas height in px
  * @param {number} trackStrokeWidth width of trackpath between interaction points
  * @param {number} interactionPointRadius radius of interaction points
  * @param {decimal} trackLabelWidth predicted width of the longest trackLabel
  * @param {number} interactionLabelHeight height in px of the interaction label
  * @param {number} fontHeightWidthRatio not sure how you calculate this for a given font so I have just set it to a reasonable number (in this case 2)
  * @param {object} margin the margin properties in px inside the canvas
  */
     var settings = {
         maxTrackNameLength: 0,
         outerWidth: 0,
         outerHeight: 0,
         trackStrokeWidth: 0,
         interactionPointRadius: 0,
         trackLabelWidth: 0,
         interactionLabelHeight: 0,
         fontHeightWidthRatio: 2,
         xRatio:0,
         yRatio:0,
         margin: { left: 0, top: 0, right: 0, bottom: 0 }
     };

/**
* private variables
*/

    var config = exports.config;

    var canvasArea = null;
    var graphArea = null;

    var eventData = [];
    var tracks = [];
    var trackDetails = {};
    var interactions = [];

    var xSpan = null;
    var ySpan = null;

    var xScale = null;
    var yScale = null;

    var screenDimensions = null;

/**
 * private functions
 */

    function setConfigFromURL() {
        var urlParams = getURLParams();
        for(var param in urlParams) {
          if(config.hasOwnProperty(param)){
            config[param] = urlParams[param];
          }
        }
    }

    function getURLParams(){
      var urlParams;
      var match,
          pl = /\+/g,  // Regex for replacing addition symbol with a space
          search = /([^&=]+)=?([^&]*)/g,
          decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
          query = window.location.search.substring(1);

      urlParams = {};
      while ((match = search.exec(query)) !== null) {
          urlParams[decode(match[1])] = decode(match[2]);
      }
      return urlParams;
    }

/**
 * loads data into eventData from either a googleSpreadSheet or a local CSV depending on config
 */
    function loadData() {
        if (config.googleSpreadSheet) {
            loadGoogleSpreadSheetData();
        } else if (config.csvFile) {
            loadCSVData();
        }
    }

    function loadCSVData() {
        d3.csv(config.csvFile, processData);
    }

    function loadGoogleSpreadSheetData() {
        Tabletop.init({
            key: config.googleSpreadSheet,
            callback: processData,
            simpleSheet: true
        });
    }

    function processData(data) {
        clear();
        validate(data);
        eventsToTracks();
        generateSettings();
        setupCanvas();
        render();
    }

/**
 * generates span settings by looking at the eventData to get order extent for x and then processing the eventData to calculate tracks for y
 * note that the y span is increased by one for convienience to include room for the timeAxis
 */
    function eventsToTracks() {
      xSpan = d3.extent(eventData, function (d) { return +d[config.eventOrderColumn]; });
      ySpan = getTrackSpan();
    }

 function getTrackSpan(){
    buildTrackDetails();
    getTracks();
    getInteractions();
    return [0, tracks.length];
 }

 /**
  * buildTrackDetails is the meat of the module
  * each interaction is processed to record each protein (protein A and B) involved
  * and the protein it interacted with (protein B against A and A against B)(interaction.name)
  * and to increment the number of events each protein is involved in (eventCount)
  * any tracks that interacted with a larger track (by eventCount) are then removed
  * @return {array} trackDetails of y axis objects (ie tracks + 1 extra for timeaxis)
  */
 function buildTrackDetails(){
   for (var i = 0, eventCount = eventData.length; i < eventCount; i++) {
     var event = eventData[i];
     addTrackDetail(event,config.proteinAColumn,config.proteinBColumn);
     addTrackDetail(event,config.proteinBColumn,config.proteinAColumn);
   }
   for (var trackName in trackDetails) {
     removeSmallerTrackDetails(trackName);
   }
 }

 function addTrackDetail(event,A,B){
   if(trackDetails[event[A]]){
     trackDetails[event[A]].interactions.push({name:event[B], order:event[config.eventOrderColumn]});
     trackDetails[event[A]].eventCount++;
   }else{
     trackDetails[event[A]] = {eventCount:1,interactions:[{name:event[B], order:event[config.eventOrderColumn]}]};
   }
 }

 function removeSmallerTrackDetails(trackName){
   var track = trackDetails[trackName];
   if(track){
     for (var i = 0, interactionCount = track.interactions.length; i < interactionCount; i++) {
       if(isSmallerTrack(trackDetails[track.interactions[i].name],track)){
         delete trackDetails[trackName];
       }
     }
   }
 }

 function isSmallerTrack(interaction,track){
   return(interaction&&track.eventCount< interaction.eventCount);
 }

 function getTracks(){
   for (var trackName in trackDetails) {
     if (settings.maxTrackNameLength < trackName.length) {
         settings.maxTrackNameLength = trackName.length;
     }
     tracks.push(trackName);
   }
   tracks.sort(
     function (a, b) {return trackDetails[b].eventCount - trackDetails[a].eventCount; }
   );
 }

function getInteractions(){
  for (var i = 0, trackCount = tracks.length; i < trackCount; i++) {
    var track = trackDetails[tracks[i]];
    for (var j = 0, interactionCount = track.interactions.length; j < interactionCount; j++) {
      var interaction = track.interactions[j];
      interaction.trackNumber = i;
      interactions.push(interaction);
   }
  }
}

    function render() {
        drawTracks();
        addTimeAxisPath();
    }

    function generateSettings() {

        screenDimensions = getScreenDimensions();
        settings.yRatio = config.yRatio?config.yRatio*config.screenProportion:getyRatio();
        settings.xRatio = config.xRatio?config.xRatio*config.screenProportion:getxRatio();
        if (!config.outerHeight) {
            config.outerHeight = screenDimensions.height * settings.yRatio;
        }
        if (!config.outerWidth) {
            config.outerWidth = screenDimensions.width * settings.xRatio;
        }
        settings.outerHeight = config.outerHeight;
        settings.outerWidth = config.outerWidth;
        settings.trackStrokeWidth = Math.min(
                Math.round(settings.outerWidth / (xSpan[1] * 5)),
                Math.round(settings.outerHeight / (ySpan[1] * 8))
        );
        settings.interactionPointRadius = settings.trackStrokeWidth;
        settings.interactionLabelHeight = settings.interactionPointRadius*1.5;
        document.documentElement.style.setProperty('--baseTextHeight', settings.interactionLabelHeight);
        settings.trackLabelWidth = settings.interactionLabelHeight * settings.maxTrackNameLength / settings.fontHeightWidthRatio;

        settings.yLabelOffset = settings.interactionPointRadius + settings.interactionLabelHeight*1.2;//1.2 so that there is a gap between the point and the text
        settings.xLabelOffset = 2 * settings.interactionPointRadius + settings.trackLabelWidth;
        settings.margin = { left: settings.xLabelOffset + settings.interactionPointRadius * 2, top: settings.interactionPointRadius * 2, right: settings.interactionPointRadius * 2, bottom: settings.interactionPointRadius * 2 };
        settings.innerWidth = settings.outerWidth - settings.margin.left - settings.margin.right;
        settings.innerHeight = settings.outerHeight - settings.margin.top - settings.margin.bottom;
    }

    function getyRatio(){
      var yRatio = (screenDimensions.width /xSpan[1] )/(screenDimensions.height /ySpan[1]);
      return yRatio>1?config.screenProportion:yRatio*config.screenProportion;
    }

    function getxRatio(){
      var xRatio = (screenDimensions.width /ySpan[1])/(screenDimensions.height /xSpan[1] );
      return xRatio>1?config.screenProportion:xRatio*config.screenProportion;
    }

    function clear(){
        if (canvasArea) { canvasArea.remove();}
        canvasArea = null;
        graphArea = null;
        eventData = [];
        trackDetails = {};
        tracks = [];
        interactions = [];
        xSpan = null;
        ySpan = null;
        xScale = null;
        yScale = null;
    }

    function setupCanvas() {
      if (d3.select(config.selector).empty()){throw "Invalid selector in config";}
        canvasArea = d3.select(config.selector).append("svg")
          .attr("width", settings.outerWidth)
          .attr("height", settings.outerHeight);

        graphArea = canvasArea.append("g")
          .attr("transform", "translate(" + settings.margin.left + "," + settings.margin.top + ")");

        xScale = d3.scaleLinear().range([0, settings.innerWidth]);
        yScale = d3.scaleLinear().range([settings.innerHeight - settings.interactionLabelHeight, 0]);

        xScale.domain(xSpan);
        yScale.domain(ySpan);
    }

    function validate(data){
      if (!validateConfig()) { throw "Config settings are invalid"; }
      if (!validateEventData(data)) { throw "Data does not match config settings";  }
    }

    function validateEventData(data) {
        eventData = data;
        return ((eventData.length > 0) && eventData[0][config.eventOrderColumn] && eventData[0][config.proteinAColumn] && eventData[0][config.proteinBColumn]);
    }

    function validateConfig() {
        return (config.screenProportion > 0 && config.screenProportion <= 1) &&
               ((config.xRatio > 0 && config.xRatio <= 1)||(!config.xRatio ) || (config.outerWidth > 0)) &&
               ((config.yRatio > 0 && config.yRatio <= 1)||(!config.yRatio ) || (config.outerHeight > 0)) &&
               (config.eventOrderColumn > "" && config.proteinAColumn > "" && config.proteinBColumn > "");
    }



    function drawTracks(){
        addTrackLabels();
        addInteractionPaths();
        addInteractionPoints();
        addInteractionLabels();
    }

    function addTrackLabels() {
        var trackLabels = graphArea.selectAll(".trackLabels").data(tracks);
        trackLabels.enter().append("text")
          .classed("trackLabel trackLabels", true)
          .style("text-anchor", "end")
          .attr("x", function (d,i) { return xScale(getFirstTrackInteraction(i).order) - 2 * settings.interactionPointRadius; })//settings.trackLabelWidth)//
          .attr("y", function (d,i) { return yScale(tracks.length - i) + settings.interactionLabelHeight / 2; })
          .text(function (d) { return d; });
        trackLabels.exit().remove();
    }

    function addInteractionPaths() {
        for (var i = 0, trackCount = tracks.length; i < trackCount; i++) {
            var path = graphArea.append("path");
            path.attr("d", drawTrackLine(getTrackInteractions(i)))
                .attr("style", "stroke-width: " + settings.interactionPointRadius + "px;")
                .classed("interactionPath", true);
        }
    }

    function addInteractionPoints() {
        var interactionPoints = graphArea.selectAll(".interactionPoints").data(interactions);
        interactionPoints.enter().append("circle")
          .classed("interactionPoints", true)
          .attr("r", settings.interactionPointRadius)
          .attr("cx", function (d) { return xScale(d.order); })
          .attr("cy", function (d) { return yScale(tracks.length - d.trackNumber); });
        interactionPoints.exit().remove();
    }

    function addInteractionLabels() {
        var interactionLabels = graphArea.selectAll(".interactionLabels").data(interactions);
        interactionLabels.enter().append("text")
          .classed("interactionLabel interactionLabels", true)
          .style("text-anchor", "end")
          .attr("x", function (d) { return xScale(d.order)+settings.interactionPointRadius; })
          .attr("y", function (d) { return yScale(tracks.length - d.trackNumber) + settings.yLabelOffset; })
          .text(function (d) { return d.name; });
        interactionLabels.exit().remove();
    }

    function addTimeAxisPath() {
        var path = graphArea.append("path");
        var span = xScale.domain();
        var timeAxisData = [{ x: xScale(span[0]), y: yScale(0) }, { x: xScale(span[1]), y: yScale(0) }, { x: xScale(span[1]), y: yScale(0) + settings.interactionPointRadius / 4 }, { x: xScale(span[1]) + settings.interactionPointRadius/2, y: yScale(0) }, { x: xScale(span[1]), y: yScale(0) - settings.interactionPointRadius / 4 }, { x: xScale(span[1]), y: yScale(0)  }];
        path.attr("d", drawTimeAxisLine(timeAxisData))
            .attr("style", "stroke-width: " + settings.interactionPointRadius/2 + "px;")
            .classed("timeAxis", true);
        addTimeAxisLabel(xScale(span[1])- settings.interactionPointRadius, yScale(0) - settings.yLabelOffset + settings.interactionPointRadius *2);
    }

    function addTimeAxisLabel(x,y) {
        graphArea.append("text")
          .classed("timeAxisLabel", true)
          .style("text-anchor", "end")
          .attr("x", x)
          .attr("y", y)
          .text("Time");
    }

    var drawTrackLine = d3.line()
          .x(function (d) { return xScale(d.order); })
          .y(function (d) { return yScale(tracks.length - d.trackNumber); });

    var drawTimeAxisLine = d3.line()
        .x(function (d) { return d.x;})
        .y(function (d) { return d.y; });

    function getTrackInteractions(trackNumber) {
        var trackInteractions = [];
        for (var i = 0, interactionCount = interactions.length; i < interactionCount; i++) {
            if (interactions[i].trackNumber == trackNumber) {
                trackInteractions.push(interactions[i]);
            }
        }
        return trackInteractions;
    }

    function getFirstTrackInteraction(trackNumber) {
        for (var i = 0, interactionCount = interactions.length; i < interactionCount; i++) {
            if (interactions[i].trackNumber == trackNumber) {
                return interactions[i];
            }
        }
    }

    function getScreenDimensions() {
        var w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            x = w.innerWidth || e.clientWidth || g.clientWidth,
            y = w.innerHeight || e.clientHeight || g.clientHeight;
        return { width: x-20, height: y-20 }; /* 20 is magic number to account for scrollbar width */
    }

    /* end internal functions */

    return exports;

}();
