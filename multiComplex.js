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
 * <li>The "Protein A" (config.proteinAColumn) column should contain the protein of one of the proteins involved in the interaction event.</li>
 * <li>The "Protein B" (config.proteinBColumn)column should contain the protein of the other protein involved in the interaction event.</li>
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
     * @property {string} eventOrderColumn - column protein for the "order" data in the file to be loaded
     * @property {string} proteinAColumn - column protein for the first protein in an interaction in the file to be loaded
     * @property {string} proteinBColumn - column protein for the second protein in an interaction in the file to be loaded
     * @property {number} minimumInteractionCount - if a track has less interactions than the minimumInteractionCount it won't be displayed
     * @property {string} removeDuplicateInteractions - can be either "true" or "false" will remove mirrored interactions from smaller tracks if true
     * @property {decimal} screenProportion - sets maximum proportion of a widow diemsion the canvas can take up, can be >0 and <= 1 eg 0.5 would take up at most half width and half height
     * @property {decimal} xRatio - ratio of x dimension of canvas to screenProportion Width, can be >0 and <= 1
     * @property {decimal} yRatio - ratio of y dimension of canvas to screenProportion Height, can be >0 and <= 1
     * @property {number} outerWidth - canvas width in px. Used to overRide the setting made by xRatio if a set canvas width is desired
     * @property {number} outerHeight - canvas height in px. used to overRide the setting made by yRatio if a set canvas height is desired
     * @property {string} selector - used to specified the DOM element that the SVG canvas will be appended to
     */
    exports.config = {
        constants: {
            sourceType: {
                GOOGLESPREADSHEET: "googleSpreadSheet",
                CSVFILE: "csvFile"
            }
        },
        sourceType: "",
        source: "",
        eventOrderColumn: "Order",
        proteinAColumn: "Protein A",
        proteinBColumn: "Protein B",
        minimumInteractionCount: 3,
        removeDuplicateInteractions: "false", // "true" or "false"
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
        setConfig();
        getInteractionEvents()
            .then(convertInteractionEventsToTracks)
            .then(generateSettings)
            .then(setupCanvas)
            .then(drawTimeAxisPath)
            .then(drawTracks);
    };

    /**
     * private variables
     */

    var config = exports.config;

    var canvasArea = null
        , graphArea = null;

    var interactionEvents = []
        , tracks = []
        , trackCounts = {};

    var xSpan = null
        , ySpan = null
        , xScale = null
        , yScale = null
        , screenDimensions = null;

    /**
     * internal settings generated from the config
     * @param {number} maxTrackNameLength the number of characters in the track with the longest protein (primary protein protein)
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
        xRatio: 0,
        yRatio: 0,
        margin: {left: 0, top: 0, right: 0, bottom: 0}
    };

    /**
     * private functions
     */
    function setConfig() {
        if (config.useURLConfig) {
            setConfigFromURL();
        }
        if (!validateConfig()) {
            throw "Config settings are invalid";
        }
    }

    function setConfigFromURL() {
        var urlParams = getURLParams();
        for (var param in urlParams) {
            if (config.hasOwnProperty(param)) {
                config[param] = urlParams[param];
            }
        }
    }

    function getURLParams() {
        var urlParams;
        var match,
            pl = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) {
                return decodeURIComponent(s.replace(pl, " "));
            },
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
    function getInteractionEvents() {
        return loadInteractionEvents()
            .then(setInteractionEvents);
    }

    function loadInteractionEvents() {
        if (config.sourceType == config.constants.sourceType.GOOGLESPREADSHEET) {
            return new Promise(loadInteractionEventsFromGoogleSpreadSheet);
        } else if (config.sourceType == config.constants.sourceType.CSVFILE) {
            return new Promise(loadInteractionEventsFromCSVFile);
        }
    }

    function loadInteractionEventsFromCSVFile(resolve, reject) {
        d3.csv(config.source, resolve);
    }

    function loadInteractionEventsFromGoogleSpreadSheet(resolve, reject) {
        Tabletop.init({
            key: config.source,
            callback: resolve,
            simpleSheet: true
        });
    }

    function setInteractionEvents(data) {
        if (validateEventData(data)) {
            interactionEvents = data;
        } else {
            throw "Data does not match config settings";
        }
    }

    /**
     * generates span settings by looking at the eventData to get order extent for x and then processing the eventData to calculate tracks for y
     * note that the y span uses the length of the array rather than the maximum index to include room for the timeAxis
     */
    function convertInteractionEventsToTracks() {
        buildTrackCounts();
        getTracks();
    }

    function getOrderSpan() {
        var minOrder = d3.min(tracks, function (d) {
            return d3.min(d.interactions, function (d) {
                return d.order;
            });
        });
        var maxOrder = d3.max(tracks, function (d) {
            return d3.max(d.interactions, function (d) {
                return d.order;
            });
        });
        return [minOrder, maxOrder];
    }

    function getTrackSpan() {
        return [0, tracks.length];
    }

    /**
     * buildTrackCounts is the meat of the module
     * each interaction is processed to record each protein (protein A and B) involved
     * and the protein it interacted with (protein B against A and A against B)(interaction.protein)
     * and to increment the number of events each protein is involved in (trackCounts)
     * any tracks with with less than config.minimumInteractionCount interactions are removed
     */
    function buildTrackCounts() {
        interactionEvents.sort(function (a, b) {
            return (+a[config.eventOrderColumn]) - (+b[config.eventOrderColumn]);
        });
        for (var i = 0, eventCount = interactionEvents.length; i < eventCount; i++) {
            var event = interactionEvents[i];
            var proteinA = event[config.proteinAColumn];
            var proteinB = event[config.proteinBColumn];
            var order = +event[config.eventOrderColumn];
            addTrackCount(proteinA, proteinB, order);
            addTrackCount(proteinB, proteinA, order);
        }

        if (config.removeDuplicateInteractions == "true") {
            removeDuplicateInteractions();
        }
        for (var protein in trackCounts) {
            if (trackCounts.hasOwnProperty(protein)) {
                removeSmallerTrackCounts(protein);
            }
        }
    }

    function addTrackCount(p1, p2, order) {
        setMaxProteinNameLength(p1);
        if (trackCounts[p1]) {
            trackCounts[p1].trackCount++;
        } else {
            trackCounts[p1] = {trackCount: 1, interactions: {}};
        }
        trackCounts[p1].interactions[p2] = order;
    }

    function removeSmallerTrackCounts(protein) {
        if (trackCounts[protein].trackCount < config.minimumInteractionCount) {
            delete trackCounts[protein];
        }
    }

    function removeDuplicateInteractions() {
        for (var proteinA in trackCounts) {
            if (trackCounts.hasOwnProperty(proteinA)) {
                for (var proteinB in trackCounts[proteinA].interactions) {
                    if (trackCounts.hasOwnProperty(proteinB)) {
                        removeDuplicateInteraction(proteinA, proteinB)
                    }
                }
            }
        }
    }

    function removeDuplicateInteraction(proteinA, proteinB) {
        if (trackCounts[proteinA].trackCount < trackCounts[proteinB].trackCount) {
            delete trackCounts[proteinA].interactions[proteinB];
            trackCounts[proteinA].trackCount--;
        }
    }

    function getTracks() {
        for (var protein in trackCounts) {
            if (trackCounts.hasOwnProperty(protein)) {
                tracks.push({protein: protein, interactions: getInteractions(trackCounts[protein].interactions)});
            }
        }
        tracks.sort(
            function (a, b) {
                return b.interactions.length - a.interactions.length;
            }
        );
    }

    function getInteractions(interactionsObj) {
        var interactions = [];
        for (interaction in interactionsObj) {
            if (interactionsObj.hasOwnProperty(interaction)) {
                interactions.push({protein: interaction, order: interactionsObj[interaction]})
            }
        }
        return interactions;
    }

    function setMaxProteinNameLength(protein) {
        if (settings.maxTrackNameLength < protein.length) {
            settings.maxTrackNameLength = protein.length;
        }
    }

    function drawTracks() {
        for (var trackNumber = 0, trackCount = tracks.length; trackNumber < trackCount; trackNumber++) {
            addTrackLabel(trackNumber);
            addTrackPath(trackNumber);
            addTrackInteractionPoints(trackNumber);
            addTrackInteractionLabels(trackNumber);
        }
    }

    function addTrackLabel(trackNumber) {
        var track = tracks[trackNumber];
        var firstOrder = track.interactions[0].order;
        graphArea.append("text")
            .classed("trackLabel track" + trackNumber, true)
            .style("text-anchor", "end")
            .attr("x", xScale(firstOrder) - 2 * settings.interactionPointRadius)
            .attr("y", yScale(tracks.length - trackNumber) + settings.interactionLabelHeight / 2)
            .text(track.protein);
    }

    function addTrackPath(trackNumber) {
        var trackinteractions = [
            {
                x: d3.min(tracks[trackNumber].interactions, function (d) {
                    return d.order;
                }), y: tracks.length - trackNumber
            },
            {
                x: d3.max(tracks[trackNumber].interactions, function (d) {
                    return d.order;
                }), y: tracks.length - trackNumber
            }
        ];
        var path = graphArea.append("path");
        path.attr("d", drawTrackLine(trackinteractions))
            .attr("style", "stroke-width: " + settings.interactionPointRadius + "px;")
            .classed("interactionPath track" + trackNumber, true);
    }

    var drawTrackLine = d3.line()
        .x(function (d) {
            return xScale(d.x);
        })
        .y(function (d) {
            return yScale(d.y);
        });

    function addTrackInteractionPoints(trackNumber) {
        var trackInteractions = tracks[trackNumber].interactions;
        /*enter*/
        var interactionPoints = graphArea.selectAll(".interactionPoint.track" + trackNumber).data(trackInteractions);
        interactionPoints.enter().append("circle")
            .classed("interactionPoint track" + trackNumber, true)
            .attr("r", settings.interactionPointRadius);
        /*update*/
        interactionPoints = graphArea.selectAll(".interactionPoint.track" + trackNumber).data(trackInteractions);
        interactionPoints.attr("cx", function (d) {
            return xScale(d.order);
        })
            .attr("cy", function (d) {
                return yScale(tracks.length - trackNumber);
            });
        /*exit*/
        interactionPoints.exit().remove();
    }

    function addTrackInteractionLabels(trackNumber) {
        var trackInteractions = tracks[trackNumber].interactions;
        /*enter*/
        var interactionLabels = graphArea.selectAll(".interactionLabel.track" + trackNumber).data(trackInteractions);
        interactionLabels.enter().append("text")
            .classed("interactionLabel track" + trackNumber, true)
            .style("text-anchor", "end");
        /*update*/
        interactionLabels = graphArea.selectAll(".interactionLabel.track" + trackNumber).data(trackInteractions);
        interactionLabels.attr("x", function (d) {
            return xScale(d.order) + settings.interactionPointRadius;
        })
            .attr("y", function (d) {
                return yScale(tracks.length - trackNumber) + settings.yLabelOffset;
            })
            .text(function (d) {
                return d.protein;
            });
        /*exit*/
        interactionLabels.exit().remove();
    }

    function drawTimeAxisPath() {
        var path = graphArea.append("path");
        var span = xScale.domain();
        var timeAxisData =
            [
                {x: xScale(span[0]), y: yScale(0)},
                {x: xScale(span[1]), y: yScale(0)},
                {x: xScale(span[1]), y: yScale(0) + settings.interactionPointRadius / 4},
                {x: xScale(span[1]) + settings.interactionPointRadius / 2, y: yScale(0)},
                {x: xScale(span[1]), y: yScale(0) - settings.interactionPointRadius / 4},
                {x: xScale(span[1]), y: yScale(0)}
            ];
        path.attr("d", drawTimeAxisLine(timeAxisData))
            .attr("style", "stroke-width: " + settings.interactionPointRadius / 2 + "px;")
            .classed("timeAxis", true);
        addTimeAxisLabel(
            xScale(span[1]) - settings.interactionPointRadius,
            yScale(0) - settings.yLabelOffset + settings.interactionPointRadius * 2
        );
    }

    var drawTimeAxisLine = d3.line()
        .x(function (d) {
            return d.x;
        })
        .y(function (d) {
            return d.y;
        });

    function addTimeAxisLabel(x, y) {
        graphArea.append("text")
            .classed("timeAxisLabel", true)
            .style("text-anchor", "end")
            .attr("x", x)
            .attr("y", y)
            .text("Time");
    }

    function generateSettings() {

        ySpan = getTrackSpan();
        xSpan = getOrderSpan();

        screenDimensions = getScreenDimensions();
        settings.yRatio = config.yRatio ? config.yRatio * config.screenProportion : getyRatio();
        settings.xRatio = config.xRatio ? config.xRatio * config.screenProportion : getxRatio();
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
        settings.interactionLabelHeight = settings.interactionPointRadius * 1.5;
        document.documentElement.style.setProperty('--baseTextHeight', settings.interactionLabelHeight);
        settings.trackLabelWidth = settings.interactionLabelHeight * settings.maxTrackNameLength / settings.fontHeightWidthRatio;

        settings.yLabelOffset = settings.interactionPointRadius + settings.interactionLabelHeight * 1.2;//1.2 so that there is a gap between the point and the text
        settings.xLabelOffset = 2 * settings.interactionPointRadius + settings.trackLabelWidth;
        settings.margin = {
            left: settings.xLabelOffset + settings.interactionPointRadius * 2,
            top: settings.interactionPointRadius * 2,
            right: settings.interactionPointRadius * 2,
            bottom: settings.interactionPointRadius * 2
        };
        settings.innerWidth = settings.outerWidth - settings.margin.left - settings.margin.right;
        settings.innerHeight = settings.outerHeight - settings.margin.top - settings.margin.bottom;
    }

    function getyRatio() {
        var yRatio = (screenDimensions.width / xSpan[1] ) / (screenDimensions.height / ySpan[1]);
        return yRatio > 1 ? config.screenProportion : yRatio * config.screenProportion;
    }

    function getxRatio() {
        var xRatio = (screenDimensions.width / ySpan[1]) / (screenDimensions.height / xSpan[1] );
        return xRatio > 1 ? config.screenProportion : xRatio * config.screenProportion;
    }

    function clear() {
        if (canvasArea) {
            canvasArea.remove();
        }
        canvasArea = null;
        graphArea = null;

        interactionEvents = [];
        trackCounts = {};
        tracks = [];

        xSpan = null;
        ySpan = null;
        xScale = null;
        yScale = null;
    }

    function setupCanvas() {
        if (d3.select(config.selector).empty()) {
            throw "Invalid selector in config";
        }
        canvasArea = d3.select(config.selector).append("svg")
            .attr("width", settings.outerWidth)
            .attr("height", settings.outerHeight);

        graphArea = canvasArea.append("g")
            .attr("transform", "translate(" + settings.margin.left + "," + settings.margin.top + ")");

        xScale = d3.scaleLinear().range([0, settings.innerWidth]);
        yScale = d3.scaleLinear().range([settings.innerHeight, 0]);

        xScale.domain(xSpan);
        yScale.domain(ySpan);
    }

    function validateEventData(data) {
        return ((data.length > 0) && data[0][config.eventOrderColumn] && data[0][config.proteinAColumn] && data[0][config.proteinBColumn]);
    }

    function validateConfig() {
        return (config.screenProportion > 0 && config.screenProportion <= 1) &&
            ((config.xRatio > 0 && config.xRatio <= 1) || (!config.xRatio ) || (config.outerWidth > 0)) &&
            ((config.yRatio > 0 && config.yRatio <= 1) || (!config.yRatio ) || (config.outerHeight > 0)) &&
            (config.minimumInteractionCount >= 1) &&
            (config.eventOrderColumn > "" && config.proteinAColumn > "" && config.proteinBColumn > "");
    }

    function getScreenDimensions() {
        var w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            x = w.innerWidth || e.clientWidth || g.clientWidth,
            y = w.innerHeight || e.clientHeight || g.clientHeight;
        return {width: x - 20, height: y - 20};
        /* 20 is magic number to account for scrollbar width */
    }

    /* end internal functions */

    return exports;

}();
