/**
 * multiComplex module
 */
 var multiComplex = function () {
   /**
    * config properties
    * @param {string} googleSpreadSheet published googleSpreadSheet link.
    * multiComplex will preferrentially load data from googleSpreadSheet
    * but if none is listed will use csvFile
    * @param {string} csvFile local .csv file to load data from
    * @param {string} eventOrderColumn column name for the "order" data in the file to be loaded
    * @param {string} proteinA column name for the first protein in an interaction in the file to be loaded
    * @param {string} proteinB column name for the second protein in an interaction in the file to be loaded
    * @param {decimal} xRatio ratio of x dimension of canvas to windowWidth, can be >0 and <= 1
    * @param {decimal} yRatio ratio of y dimension of canvas to windowHeight, can be >0 and <= 1
    * @param {number} outerWidth canvas width in px. Used to overRide the setting made by xRatio if a set canvas width is desired,
    * @param {number} outerHeight canvas height in px. used to overRide the setting made by yRatio if a set canvas height is desired,
    */
    var config = {
        googleSpreadSheet:"https://docs.google.com/SpreadSheets/d/1mlnSovT52sNoAtfnB44wFqecsVE-U3M4dNAPVO9ZQws/pubhtml",
        csvFile: "Programming Task - Protein Multicomplex Formation Data - TimeSeries Data.csv",
        eventOrderColumn: "Order",
        proteinA: "Protein A",
        proteinB: "Protein B",
        xRatio: 0.5,
        yRatio: 0.5,
        outerWidth: null,
        outerHeight: null,
        useURLConfig: false
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
        margin: { left: 0, top: 0, right: 0, bottom: 0 }
    };

    /**
     * main function triggers loading and processing data, generating settings from config and rendering data
     */
    function draw() {
        if (config.useURLConfig) {
            setConfigFromURL();
        }
        loadData();
    }

    /**
     * internal variables
     */
    var canvasArea = null;
    var graphArea = null;

    var eventData = [];
    var tracks = [];
    var interactions = [];

    var proteinCounts = {};
    var proteinOrder = [];

    var xSpan = null;
    var ySpan = null;

    var xScale = null;
    var yScale = null;

    /* internal functions*/

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

    function eventsToTracks() {
        xSpan = d3.extent(eventData, function (d) { return +d[config.eventOrderColumn]; });
        ySpan = buildTracks();
    }

    /**
     * buildTracks is the meat of the module
     * The proteins listed in the data are ordered in descending order by the number of interactions they are involved in
     * The protein involved in the most interactions is used to build a track and add it to the tracks variable
     * any interactions the protein was involved in are loaded to the interactions variable
     * then the event data is removed and proteinCounts recalculated
     * then the protein involved in the next most interactions from the remaining event data
     * is used to build the next track and set of interactions till all the tracks are built and no event data remains
     * populates internal variable tracks with an array of tracks made up of trackName (primary protein in interaction) and trackNumber
     * populates internal variable interactions with an array of interactions made up of trackNumber, name(of secondary protein in interaction) and order
     * clears eventData
     * @return {number_array} extent of y axis objects (ie tracks + 1 extra for timeaxis)
     */

    function buildTracks() {
        var i = 0;
        while (eventData.length > 0) {
            getProteinOrder();
            var trackName = proteinOrder[0];
            var track = { trackName: trackName, trackNumber: i++ };
            if (settings.maxTrackNameLength < trackName.length) {
                settings.maxTrackNameLength = trackName.length;
            }
            tracks.push(track);
            eventsToInterations(track.trackNumber);
        }
        return [0, tracks.length];
    }

    function getProteinOrder() {
      if(proteinOrder.length === 0){
        buildProteinCounts();
      }
      proteinOrder = Object.keys(proteinCounts).sort(
        function (a, b) { return proteinCounts[b] - proteinCounts[a]; }
      );
    }

    function buildProteinCounts(){
      for (var i = 0, events = eventData.length; i < events; i++) {
        addProteinCount(eventData[i][config.proteinA]);
        addProteinCount(eventData[i][config.proteinB]);
      }
    }

    function addProteinCount(proteinName) {
        proteinCounts[proteinName] = (proteinCounts[proteinName] ? proteinCounts[proteinName] + 1 : 1);
    }

    function deleteProteinCount(proteinName) {
      if(proteinCounts[proteinName]>0){
        proteinCounts[proteinName] = proteinCounts[proteinName] - 1;
      }else{
        delete proteinCounts[proteinName];
      }
    }

    function eventsToInterations(trackNumber) {
        var trackName = proteinOrder[0];
        for (var i = 0, eventCount = eventData.length; i < eventCount; i++) {
            var interaction = {};
            var interactionName = getInteractionName(eventData[i], trackName);

            if (interactionName) {
                interaction.trackNumber = trackNumber;
                interaction.name = interactionName;
                interaction.order = +eventData[i][config.eventOrderColumn];
                interactions.push(interaction);
                eventData.splice(i, 1);
                i--;
                eventCount--;
                deleteProteinCount(trackName);
                deleteProteinCount(interactionName);
            }
        }
    }

    function getInteractionName(data,trackName) {
        var columnName = "";
        if (data[config.proteinA] == trackName) {
            columnName = config.proteinB;
        } else if (data[config.proteinB] == trackName) {
            columnName = config.proteinA;
        }
        return data[columnName];
    }

    function render() {
        drawTracks();
        addTimeAxisPath();
    }

    function generateSettings() {

        var screenDimensions = getScreenDimensions();
        if (!config.outerHeight) {
            config.outerHeight = screenDimensions.height * config.yRatio;
        }
        if (!config.outerWidth) {
            config.outerWidth = screenDimensions.width * config.xRatio;
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

    function clear(){
        if (canvasArea) { canvasArea.remove();}
        canvasArea = null;
        graphArea = null;
        eventData = [];
        tracks = [];
        interactions = [];
        proteinCounts = {};
        proteinOrder = [];
        xSpan = null;
        ySpan = null;
        xScale = null;
        yScale = null;
    }

    function setupCanvas() {
        canvasArea = d3.select("body").append("svg")
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
        return ((eventData.length > 0) && eventData[0][config.eventOrderColumn] && eventData[0][config.proteinA] && eventData[0][config.proteinB]);
    }

    function validateConfig() {
        return ((config.xRatio > 0 && config.xRatio <= 1) || (config.outerWidth > 0)) &&
               ((config.yRatio > 0 && config.yRatio <= 1) || (config.outerHeight > 0)) &&
               (config.eventOrderColumn > "" && config.proteinA > "" && config.proteinB > "");
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
          .attr("x", function (d) { return xScale(getFirstTrackInteraction(d.trackNumber).order) - 2 * settings.interactionPointRadius; })//settings.trackLabelWidth)//
          .attr("y", function (d) { return yScale(tracks.length - d.trackNumber) + settings.interactionLabelHeight / 2; })
          .text(function (d) { return d.trackName; });
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
          .style("text-anchor", "middle")
          .attr("x", function (d) { return xScale(d.order); })
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

    /* end helper functions */

    return { config: config, draw: draw };

}();
