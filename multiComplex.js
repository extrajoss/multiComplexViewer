var multiComplex = function () {

    var config = {
        googleSpreadSheet:null,
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

    var settings = {
        tracks: 0,
        interactions: 0,
        maxTrackNameLength: 0,
        fontHeightWidthRatio: 2, /* not sure how you calculate this so I have just set it to a reasonable number */
        outerWidth: 0,
        outerHeight: 0,
        circleRadius: 0,
        trackLabelWidth: 0,
        interactionLabelHeight: 0,
        margin: { left: 0, top: 0, right: 0, bottom: 0 }
    };

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

    function loadData() {        
        if (config.googleSpreadSheet) {
            loadSpreadsheetData();
        } else if (config.csvFile) {
            loadCSVData();
        }
    }

    function draw() {

        if (config.useURLConfig) {
            setConfigFromURL();
        }
        loadData();        

    }

    function render() {
        drawTracks();
        addTimeAxisPath();
    }


    /* helper functions*/

    function setConfigFromURL() {
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
        for(var param in urlParams) {
            config[param] = urlParams[param];
        }
    }

    function settingsFromConfig() {
        
        var screenDimensions = getScreenDimensions();
        if (!config.outerHeight) {
            config.outerHeight = screenDimensions.height * config.yRatio;
        }
        if (!config.outerWidth) {
            config.outerWidth = screenDimensions.width * config.xRatio;                        
        }
        settings.outerHeight = config.outerHeight;
        settings.outerWidth = config.outerWidth;
        settings.circleRadius = Math.min(
                Math.round(settings.outerWidth / (settings.interactions * 4)),
                Math.round(settings.outerHeight / (settings.tracks * 6))
        );
        settings.interactionLabelHeight = settings.circleRadius;
        document.documentElement.style.setProperty('--baseTextHeight', settings.interactionLabelHeight);
        settings.trackLabelWidth = settings.interactionLabelHeight * settings.maxTrackNameLength / settings.fontHeightWidthRatio;        

        settings.yLabelOffset = settings.circleRadius + settings.interactionLabelHeight;
        settings.xLabelOffset = 2 * settings.circleRadius + settings.trackLabelWidth;
        settings.margin = { left: settings.xLabelOffset + settings.circleRadius * 2, top: settings.circleRadius * 2, right: settings.circleRadius * 2, bottom: settings.circleRadius * 2 };
        settings.innerWidth = settings.outerWidth - settings.margin.left - settings.margin.right;
        settings.innerHeight = settings.outerHeight - settings.margin.top - settings.margin.bottom;
    }

    function loadCSVData() {
        d3.csv(config.csvFile, initialiseFromData);
    }

    function loadSpreadsheetData() {
        Tabletop.draw({
            key: config.googleSpreadSheet,
            callback: initialiseFromData,
            simpleSheet: true
        });
    }

    function initialiseFromData(data) {
        clearSettings();
        if (!validateConfig()) { alert("Config settings are invalid"); return; }
        if (!validateEventData(data)) { alert("Data does not match config settings"); return; }        

        eventsToTracks();
        settingsFromConfig();

        setupCanvas();
        render();
    }

    function eventsToTracks() {
        xSpan = d3.extent(eventData, function (d) { return +d[config.eventOrderColumn]; });
        ySpan = buildTracks();
    }

    function clearSettings(){

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

    function validateEventData(data) {
        eventData = data;
        return ((eventData.length > 0) && eventData[0][config.eventOrderColumn] && eventData[0][config.proteinA] && eventData[0][config.proteinB]);
    }

    function validateConfig() {
        return ((config.xRatio > 0 && config.xRatio <= 1) || (config.outerWidth > 0)) &&
               ((config.yRatio > 0 && config.yRatio <= 1) || (config.outerHeight > 0)) &&
               (config.eventOrderColumn > "" && config.proteinA > "" && config.proteinB > "");
    }

    function buildTracks() {
        var i = 0;
        while (eventData.length > 0) {
            getProteinOrder(eventData);
            var trackName = proteinOrder[0];
            var track = { trackName: trackName, trackNumber: i++ };
            if (settings.maxTrackNameLength < trackName.length) {
                settings.maxTrackNameLength = trackName.length;
            }
            tracks.push(track);
            eventsToInterations(track.trackNumber);
        }        
        settings.tracks = tracks.length;
        return [0, tracks.length];
    }

    function drawTracks(){
        addTrackLabels();
        addInteractionPaths();
        addInteractionPoints();
        addInteractionLabels();
    }

    function eventsToInterations(trackNumber) {
        var trackName = proteinOrder[0];
        for (var i = 0, eventCount = eventData.length; i < eventCount; i++) {
            var interaction = {};
            var interactionName = getInteractionName(eventData[i], trackName);

            if (interactionName) {
                interaction.order = +eventData[i][config.eventOrderColumn];
                interaction.trackNumber = trackNumber;
                interaction.name = interactionName;
                interactions.push(interaction);
                eventData.splice(i, 1);
                i--;
                eventCount--;
                if (settings.interactions < interaction.order) {
                    settings.interactions = interaction.order;
                }
            }
        }
    }

    function getProteinOrder() {
        proteinCounts = {};
        for (var i = 0, events = eventData.length; i < events; i++) {
            addProteinCount(eventData[i][config.proteinA]);
            addProteinCount(eventData[i][config.proteinB]);
        }
        proteinOrder = Object.keys(proteinCounts).sort(function (a, b) { return proteinCounts[b] - proteinCounts[a]; });
    }

    function addProteinCount(proteinName) {        
        proteinCounts[proteinName] = proteinCounts[proteinName] ? proteinCounts[proteinName] + 1 : 1;
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

    function addTrackLabels() {
        var trackLabels = graphArea.selectAll(".trackLabels").data(tracks);
        trackLabels.enter().append("text")
          .classed("trackLabel trackLabels", true)
          .style("text-anchor", "end")
          .attr("x", function (d) { return xScale(getFirstTrackInteraction(d.trackNumber).order) - 2 * settings.circleRadius; })//settings.trackLabelWidth)//
          .attr("y", function (d) { return yScale(tracks.length - d.trackNumber) + settings.interactionLabelHeight / 2; })
          .text(function (d) { return d.trackName; });
        trackLabels.exit().remove();
    }

    function addInteractionPaths() {
        for (var i = 0, trackCount = tracks.length; i < trackCount; i++) {
            var path = graphArea.append("path");
            path.attr("d", drawTrackLine(getTrackInteractions(i)))
                .attr("style", "stroke-width: " + settings.circleRadius + "px;")
                .classed("interactionPath", true);
        }
    }

    function addInteractionPoints() {
        var interactionPoints = graphArea.selectAll(".interactionPoints").data(interactions);
        interactionPoints.enter().append("circle")
          .classed("interactionPoints", true)
          .attr("r", settings.circleRadius)
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
        var timeAxisData = [{ x: xScale(span[0]), y: yScale(0) }, { x: xScale(span[1]), y: yScale(0) }, { x: xScale(span[1]), y: yScale(0) + settings.circleRadius / 4 }, { x: xScale(span[1]) + settings.circleRadius/2, y: yScale(0) }, { x: xScale(span[1]), y: yScale(0) - settings.circleRadius / 4 }, { x: xScale(span[1]), y: yScale(0)  }];
        path.attr("d", drawTimeAxisLine(timeAxisData))
            .attr("style", "stroke-width: " + settings.circleRadius/2 + "px;")
            .classed("timeAxis", true);
        addTimeAxisLabel(xScale(span[1])- settings.circleRadius, yScale(0) - settings.yLabelOffset + settings.circleRadius );
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