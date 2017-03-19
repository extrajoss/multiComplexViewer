/* globals d3,Tabletop */
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
 * <li>The "Order" (config.timePointColumn)column should specify the order in which the interaction events occur in contiguous incrementing integers starting from 1</li>
 * @example
 * multiComplex.config.sourceType = multiComplex.constants.sourceType.GOOGLE_SPREADSHEET;
 * multiComplex.config.source =  "https://docs.google.com/spreadsheets/d/1mlnSovT52sNoAtfnB44wFqecsVE-U3M4dNAPVO9ZQws/pubhtml";
 * muliComplex.config.selector = "#mySelector";
 * multiComplex.draw();
 * @module multiComplex
 * @requires d3.js
 * @requires tabletop.js
 */

let multiComplex = function () {
    "use strict";
    let multiComplexReturns = {};

    /**
     * configuration settings to determine how the module will load event data and render tracks
     * @property {url} googleSpreadSheet - published googleSpreadSheet link.
     * <br/>multiComplex will preferrentially load data from googleSpreadSheet
     * but if none is listed will use csvFile
     * @property {filePath} csvFile - local .csv file to load data from
     * @property {string} timePointColumn - column protein for the "order" data in the file to be loaded
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

    multiComplexReturns.config = {
        sourceType: "",
        source: "",
        timePointColumn: "Order",
        proteinAColumn: "Protein A",
        proteinBColumn: "Protein B",
        minimumInteractionCount: 3,
        removeDuplicateInteractions: "false", // "true" or "false"
        screenProportion: 0.7,
        outerWidth: null,
        outerHeight: null,
        xRatio: null,
        yRatio: null,
        useURLConfig: false,
        selector: "body"
    };

    multiComplexReturns.constants = Object.freeze({
        sourceType: Object.freeze({
            GOOGLE_SPREADSHEET: "googleSpreadSheet",
            CSV_FILE: "csvFile"
        })
    });

    /**
     * Triggers loading and processing data, generating settings from config and rendering data
     */


    multiComplexReturns.draw = function () {
        setConfig();
        getInteractionEvents()
            .then(convertInteractionEventsToTracks)
            .then(generateSettings)
            .then(setupCanvas)
            .then(drawTimeAxis)
            .then(drawTracks)
            .catch(toConsoleError);
    };

    /**
     * private variables
     */

    let config = multiComplexReturns.config;
    const constants = multiComplexReturns.constants;

    let canvasArea = null,
        graphArea = null;

    let interactionEvents = [],
        tracks = [],
        trackCounts = Object.create(null);

    let xSpan = null,
        ySpan = null,
        xScale = null,
        yScale = null,
        screenDimensions = null;
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

    let settings = {
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
        clear();
        if (config.useURLConfig) {
            setConfigFromURL();
        }
        validateConfig();
    }

    function setConfigFromURL() {
        let urlParams = getURLParams();
        for(let param in urlParams) {
            if (urlParams.hasOwnProperty(param) && config.hasOwnProperty(param)) {
                config[param] = urlParams[param];
            }
        }
    }

    function getURLParams() {
        let urlParams;
        let match,
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
        if (config.sourceType === constants.sourceType.GOOGLE_SPREADSHEET) {
            return new Promise(loadInteractionEventsFromGoogleSpreadSheet);
        } else if (config.sourceType === constants.sourceType.CSV_FILE) {
            return new Promise(loadInteractionEventsFromCSVFile);
        }
    }

    function loadInteractionEventsFromCSVFile(resolve) {
        d3.csv(config.source, resolve);
    }

    function loadInteractionEventsFromGoogleSpreadSheet(resolve) {
        Tabletop.init({
            key: config.source,
            callback: resolve,
            simpleSheet: true
        });
    }

    function setInteractionEvents(data) {
        if (validateEventData(data)) {
            interactionEvents = data;
        }
    }

    /**
     * generates span settings by looking at the eventData to get order extent for x and then processing the eventData to calculate tracks for y
     * note that the y span uses the length of the array rather than the maximum index to include room for the timeAxis
     */

    function getTimePointSpan() {        
        let minTimePoint = d3.min(tracks, function (d) {
            return d3.min(d.interactions, function (d) {
                return d.timePoint;
            });
        });        
        let maxTimePoint = d3.max(tracks, function (d) {
            return d3.max(d.interactions, function (d) {
                return d.timePoint;
            });
        });
        return [minTimePoint, maxTimePoint];
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
            return (+a[config.timePointColumn]) - (+b[config.timePointColumn]);
        });
        for (let i = 0, eventCount = interactionEvents.length; i < eventCount; i++) {
            let event = interactionEvents[i];
            let proteinA = event[config.proteinAColumn];
            let proteinB = event[config.proteinBColumn];
            let timePoint = +event[config.timePointColumn];
            addTrackCount(proteinA, proteinB, timePoint);
            addTrackCount(proteinB, proteinA, timePoint);
        }

        if (config.removeDuplicateInteractions === "true") {
            removeDuplicateInteractions();
        }
        for (let protein in trackCounts) {
            removeSmallerTrackCounts(protein);
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

    function addTrackCount(p1, p2, timePoint) {
        setMaxProteinNameLength(p1);
        if (trackCounts[p1]) {
            trackCounts[p1].trackCount++;
        } else {
            trackCounts[p1] = {trackCount: 1, interactions: Object.create(null)};
        }
        trackCounts[p1].interactions[p2] = timePoint;
    }

    function removeSmallerTrackCounts(protein) {
        if (trackCounts[protein].trackCount < config.minimumInteractionCount) {
            delete trackCounts[protein];
        }
    }

    function removeDuplicateInteractions() {
        for (let proteinA in trackCounts) {
            if (trackCounts.hasOwnProperty(proteinA)) {
                for (let proteinB in trackCounts[proteinA].interactions) {
                    if (trackCounts.hasOwnProperty(proteinB)) {
                        removeDuplicateInteraction(proteinA, proteinB);
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
        for (let protein in trackCounts) {
            tracks.push({protein: protein, interactions: getTrackInteractions(trackCounts[protein].interactions)});
        }
        tracks.sort(
            function (a, b) {
                return b.interactions.length - a.interactions.length;
            }
        );
    }

    function getTrackInteractions(interactions) {
        let trackInteractions = [];
        for (let interaction in interactions) {
            trackInteractions.push({protein: interaction, timePoint: interactions[interaction]});
        }
        return trackInteractions;
    }

    function setMaxProteinNameLength(protein) {
        if (settings.maxTrackNameLength < protein.length) {
            settings.maxTrackNameLength = protein.length;
        }
    }

    function drawTracks() {
        for (let trackNumber = 0, trackCount = tracks.length; trackNumber < trackCount; trackNumber++) {
            drawTrack(trackNumber);
        }
    }

    function drawTrack(trackNumber) {
        addTrackLabel(trackNumber);
        addTrackPath(trackNumber);
        addTrackInteractionPoints(trackNumber);
        addTrackInteractionLabels(trackNumber);
    }

    function addTrackLabel(trackNumber) {
        let track = tracks[trackNumber];
        let firstTimePoint = track.interactions[0].timePoint;
        graphArea.append("text")
            .classed("trackLabel track" + trackNumber, true)
            .style("text-anchor", "end")
            .attr("x", xScale(firstTimePoint) - 2 * settings.interactionPointRadius)
            .attr("y", yScale(tracks.length - trackNumber) + settings.interactionLabelHeight / 2)
            .text(track.protein);
    }

    function addTrackPath(trackNumber) {
        let trackInteractions = [
            {
                x: d3.min(tracks[trackNumber].interactions, function (d) {
                    return d.timePoint;
                }), y: tracks.length - trackNumber
            },
            {
                x: d3.max(tracks[trackNumber].interactions, function (d) {
                    return d.timePoint;
                }), y: tracks.length - trackNumber
            }
        ];
        let path = graphArea.append("path");
        path.attr("d", drawTrackLine(trackInteractions))
            .attr("style", "stroke-width: " + settings.interactionPointRadius + "px;")
            .classed("interactionPath track" + trackNumber, true);
    }

    let drawTrackLine = d3.line()
        .x(function (d) {
            return xScale(d.x);
        })
        .y(function (d) {
            return yScale(d.y);
        });

    function addTrackInteractionPoints(trackNumber) {
        let trackInteractions = tracks[trackNumber].interactions;

        /*enter*/
        let interactionPoints = graphArea
            .selectAll(".interactionPoint.track" + trackNumber)
            .data(trackInteractions);

        interactionPoints = interactionPoints
            .enter()
            .append("circle")
            .classed("interactionPoint track" + trackNumber, true)
            .attr("r", settings.interactionPointRadius);

        /*update*/
        interactionPoints
            .attr("cx", getInteractionPointX)
            .attr("cy", getInteractionPointY);
        /*exit*/
        interactionPoints.exit().remove();

        function getInteractionPointX(d) {
            return xScale(d.timePoint);
        }

        function getInteractionPointY() {
            return yScale(tracks.length - trackNumber);
        }
    }

    function addTrackInteractionLabels(trackNumber) {

        let trackInteractions = tracks[trackNumber].interactions;

        let interactionLabels = graphArea
            .selectAll(".interactionLabel.track" + trackNumber)
            .data(trackInteractions);

        /*enter*/
        interactionLabels = interactionLabels
            .enter().append("text")
            .classed("interactionLabel track" + trackNumber, true)
            .style("text-anchor", "end");

        /*update*/
        interactionLabels
            .attr("x", getInteractionLabelX)
            .attr("y", getInteractionLabelY)
            .text(getInteractionLabel);

        /*exit*/
        interactionLabels.exit().remove();

        function getInteractionLabelX(d) {
            return xScale(d.timePoint) + settings.interactionPointRadius;
        }

        function getInteractionLabelY() {
            return yScale(tracks.length - trackNumber) + settings.yLabelOffset;
        }

        function getInteractionLabel(d) {
            return d.protein;
        }
    }

    function drawTimeAxis() {
        let path = graphArea.append("path");
        let span = xScale.domain();
        let maxTimePoint = span[1];
        let timeAxisData =
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
            xScale(maxTimePoint) - settings.interactionPointRadius,
            yScale(0) - settings.yLabelOffset + settings.interactionPointRadius * 2
        );
    }
      
    let drawTimeAxisLine = d3.line()
        .x(function (d) {
            return d.x;
        })
        .y(function (d) {
            return d.y;
        });

    function addTimeAxisLabel(x, y) {
        graphArea
            .append("text")
            .classed("timeAxisLabel", true)
            .style("text-anchor", "end")
            .attr("x", x)
            .attr("y", y)
            .text("Time");
    }

    function generateSettings() {

        ySpan = getTrackSpan();
        xSpan = getTimePointSpan();

        let maxTimePoint = xSpan[1],
            maxTrack = ySpan[1];

        screenDimensions = getScreenDimensions();

        settings.yRatio = (
            config.yRatio ?
                config.yRatio * config.screenProportion :
                getYRatio()
        );

        settings.xRatio = (
            config.xRatio ?
                config.xRatio * config.screenProportion :
                getXRatio()
        );

        settings.outerHeight = (
            config.outerHeight ?
                config.outerHeight :
                screenDimensions.height * settings.yRatio
        );
        settings.outerWidth = (
            config.outerWidth ?
                config.outerWidth :
                screenDimensions.width * settings.xRatio
        );

        settings.trackStrokeWidth = Math.min(
            Math.round(settings.outerWidth / (maxTimePoint * 5)),
            Math.round(settings.outerHeight / (maxTrack * 8))
        );
        settings.interactionPointRadius = settings.trackStrokeWidth;

        settings.interactionLabelHeight = settings.interactionPointRadius * 1.5;
        document.documentElement.style.setProperty('--baseTextHeight', settings.interactionLabelHeight.toString(), "");

        settings.trackLabelWidth = settings.interactionLabelHeight * settings.maxTrackNameLength / settings.fontHeightWidthRatio;

        settings.yLabelOffset = settings.interactionPointRadius + settings.interactionLabelHeight * 1.2;//1.2 so that there is a 20% gap between the point and the text
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

    function getYRatio() {
        let maxTimePoint = xSpan[1],
            maxTrack = ySpan[1];
        let yRatio = (screenDimensions.width / maxTrack ) / (screenDimensions.height / maxTimePoint);
        return yRatio > 1 ? config.screenProportion : yRatio * config.screenProportion;
    }

    function getXRatio() {
        let maxTimePoint = xSpan[1],
            maxTrack = ySpan[1];
        let xRatio = (screenDimensions.width / maxTrack) / (screenDimensions.height / maxTimePoint );
        return xRatio > 1 ? config.screenProportion : xRatio * config.screenProportion;
    }

    function clear() {
        if (canvasArea) {
            canvasArea.remove();
        }
        canvasArea = null;
        graphArea = null;

        interactionEvents = [];
        trackCounts = Object.create(null);
        tracks = [];

        xSpan = null;
        ySpan = null;
        xScale = null;
        yScale = null;
    }

    function setupCanvas() {
        canvasArea = d3.select(config.selector)
            .append("svg")
            .attr("width", settings.outerWidth)
            .attr("height", settings.outerHeight);

        graphArea = canvasArea
            .append("g")
            .attr("transform", "translate(" + settings.margin.left + "," + settings.margin.top + ")");

        xScale = d3.scaleLinear().range([0, settings.innerWidth]);
        yScale = d3.scaleLinear().range([settings.innerHeight, 0]);

        xScale.domain(xSpan);
        yScale.domain(ySpan);
    }

    function validateEventData(data) {
        if (!((data.length > 0) && data[0][config.timePointColumn] && data[0][config.proteinAColumn] && data[0][config.proteinBColumn])) {
            throw "Data loaded does not match config settings";
        }
        return true;
    }

    function validateConfig() {
        if (!(config.screenProportion > 0 && config.screenProportion <= 1)) {
            throw "Config screenProportion settings are invalid";
        }
        if (!((config.xRatio > 0 && config.xRatio <= 1) || (!config.xRatio ) || (config.outerWidth > 0))) {
            throw "Config Width settings are invalid";
        }
        if (!((config.yRatio > 0 && config.yRatio <= 1) || (!config.yRatio ) || (config.outerHeight > 0))) {
            throw "Config Height settings are invalid";
        }
        if (!(config.minimumInteractionCount >= 1)) {
            throw "Config minimumInteractionCount settings are invalid";
        }
        if (!(config.timePointColumn > "" && config.proteinAColumn > "" && config.proteinBColumn > "")) {
            throw "Config import column settings are invalid";
        }
        if (d3.select(config.selector).empty()) {
            throw "Config selector settings are invalid";
        }
        return true;
    }

    function getScreenDimensions() {
        const SCROLLBAR_WIDTH = 20;
        let w = window,
            d = document,
            e = d.documentElement,
            g = d.getElementsByTagName('body')[0],
            x = w.innerWidth || e.clientWidth || g.clientWidth,
            y = w.innerHeight || e.clientHeight || g.clientHeight;
        return {width: x - SCROLLBAR_WIDTH, height: y - SCROLLBAR_WIDTH};
    }

    function toConsoleError(err) {
        if (window.console) {
            window.console.log(err);
        }
    }

    /* end internal functions */

    /*return public interface*/
    return multiComplexReturns;

}();
