function GraphOnMap(){
}
GraphOnMap.DefaultValues_MapGraph = {
    rotateX: 60,
    rotateZ: -27
}
GraphOnMap.DefaultValues_Plot = {
    scale: 5,
    textDisplayTemplate: "Drive home<br/>{textDisplayProperty}",
    fillStyle: "rgba(58,202,71, 0.1)",
    strokeStyle: "rgba(58,202,71, 0.4)",
    drawGlass: true,
    yAxisOffset: 0
}
GraphOnMap.SetDefaultProperties = function (defaultsObj, targetObj) {
    for (var propertyName in defaultsObj) {
        if (typeof targetObj[propertyName] == "undefined") {
            targetObj[propertyName] = defaultsObj[propertyName];
        }
    }
}
GraphOnMap.prototype.PlotStepSize = function(){
	return 1;
}
GraphOnMap.prototype.SetDefaults = function ()
{
    GraphOnMap.SetDefaultProperties(GraphOnMap.DefaultValues_MapGraph, this);
    for (var i = 0; i < this.Plots.length; i++)
	{
        GraphOnMap.SetDefaultProperties(GraphOnMap.DefaultValues_Plot, this.Plots[i]);
    }
}
GraphOnMap.InnerHtml = 	'<div id="myMapGraphDiv_MainContainer" class="MainContainer">'+
								'<div id="myMapGraphDiv_GraphCanvasContainer" class="MapGraph_GraphCanvasContainer"></div>'+
								'<div id="myMapGraphDiv_MapAndGraphContainer" class="MapGraph_MapAndGraphContainer">'+
									'<div id="myMapGraphDiv_mapcontainer" class="MapGraph_MapContainer">'+
										'<div id="myMapGraphDiv_map-canvas" class="MapGraph_map-canvas"/></div>'+
									'</div>'+
								'</div>'+
								'<div id="myMapGraphDiv_GoogleLogo" class="MapGraph_GoogleLogo"></div>'+
							'</div>';
GraphOnMap.prototype.initialize = function (ContainerDivId)
{
    this.SetDefaults();
	this.stopAutoRotate = true;
	clearTimeout(this.RotationTimeout);
	this.overlay = null;
	this.projection = null;
	this.ContainerDivId = ContainerDivId;
	$("#" + this.ContainerDivId).html(GraphOnMap.InnerHtml);
    /*GraphOnMapContainer*/
	this.ContainerWidth = $("#" + this.ContainerDivId).width();
	this.ContainerHeight = $("#" + this.ContainerDivId).height();
	if (this.ContainerWidth > 1000) this.ContainerWidth = 1000;
	this.ContainerHeight = this.ContainerWidth / 3 * 2;
	$("#" + this.ContainerDivId).width(this.ContainerWidth);
	$("#" + this.ContainerDivId).height(this.ContainerHeight);
	$("#" + this.ContainerDivId + "_mapcontainer").css("width", this.ContainerWidth * 2);
	$("#" + this.ContainerDivId + "_mapcontainer").css("height", this.ContainerHeight * 3);
	$("#" + this.ContainerDivId + "_mapcontainer").css("left", -this.ContainerWidth / 2);
	$("#" + this.ContainerDivId + "_mapcontainer").css("top", -this.ContainerHeight);
	$("#" + this.ContainerDivId + "_GoogleLogo").css("top", this.ContainerHeight - 30);
	this.rotate(0,0);
	var mapOptions =
	{
		zoom: 14,
		streetViewControl: true,
		panControl: true,
		zoomControl: true,
		mapTypeControl: true,
		draggable: true,
		mapTypeId: google.maps.MapTypeId.SATELLITE,
		tilt: 45
	};
	this.map = new google.maps.Map(document.getElementById(this.ContainerDivId + "_map-canvas"), mapOptions);
	var bounds = new google.maps.LatLngBounds();
	/*Go through each...*/
	for(var p=0; p< this.Plots.length; p++)
	{
		this.Plots[p].dataSetIndex = this.GetDataSetIndexById(this.Plots[p].dataset);
		var dataSetIndex = this.Plots[p].dataSetIndex;
		var dataSet = this.DataSets[dataSetIndex].data;
		for (var i = 0, LtLgLen = dataSet.length; i < LtLgLen; i++)
		{
			/*And increase the bounds to take this point*/
			bounds.extend(new google.maps.LatLng(dataSet[i].lat, dataSet[i].lon));
		}
	}
    /*extend the bounds to compensate for the cut-off map*/
	var latDiff = bounds.getNorthEast().lat() - bounds.getSouthWest().lat();
	var lngDiff = bounds.getNorthEast().lng() - bounds.getSouthWest().lng();
	var latFactor = 2;
	var newNE = bounds.getNorthEast();
	bounds.extend(new google.maps.LatLng(bounds.getNorthEast().lat() + latDiff * latFactor, bounds.getNorthEast().lng() + lngDiff * latFactor));
	var newSW = bounds.getNorthEast();
	bounds.extend(new google.maps.LatLng(bounds.getSouthWest().lat() - latDiff * latFactor, bounds.getSouthWest().lng() - lngDiff * latFactor));
	/*Fit these bounds to the map*/
	this.map.fitBounds(bounds);
	this.DrawGraphStart();
    google.maps.event.addListener(this.map, 'zoom_changed', function () {this.DrawGraphStart();}.bind(this));
	this.SetUpDraggingEvents();
}
GraphOnMap.prototype.AutoRotate = function(doit){
	if(!this.autoRotate) return;
	if(this.stopAutoRotate == true) return;
	if(doit) this.RotateAndTilt(0.2, 0);
	this.RotationTimeout = setTimeout(function(){ this.AutoRotate(true); }.bind(this),60);
}
GraphOnMap.prototype.OnDragStart = function (event) {
    event = this.AdjustEventToHandleTouchscreen(event);
	this.lastDragX = event.pageX;
	this.lastDragY = event.pageY;
}
GraphOnMap.prototype.SetUpDraggingEvents = function() {
	this.isDragging = false;
	$("#" + this.ContainerDivId + "").mousedown(function(event) {
		this.OnDragStart(event);
		$(window).mousemove(function(event) {
			this.OnDrag(event);
		}.bind(this));
	}.bind(this))
	.mouseup(function (event) {
		this.OnDragEnd(event);
		this.isDragging = false;
		$(window).unbind("mousemove");
	}.bind(this));
	$("#" + this.ContainerDivId + "").on("mousewheel", function (event) {
	    this.OnWheel(event);
		event.preventDefault();
	}.bind(this));	
}
GraphOnMap.prototype.ConvertCoordsToCompensateForRotation = function (coords, RotationAngle) {
    var CentrePosIfNoRotation = { x: $("#" + this.ContainerDivId + "_mapcontainer").width() / 2, y: $("#" + this.ContainerDivId + "_mapcontainer").height() / 2 };
    var CentrePosWithRotation = { x: $("#" + this.ContainerDivId + "_mapcontainer").width() / 2, y: $("#" + this.ContainerDivId + "_mapcontainer").height() / 2 };
    var OffsetFromCentrePosIfNoRotation = { x: coords.x - CentrePosIfNoRotation.x, y: coords.y - CentrePosIfNoRotation.y };
    var AngleFromCentreIfNoRotation = Math.atan(OffsetFromCentrePosIfNoRotation.y / OffsetFromCentrePosIfNoRotation.x);
    var DistanceFromCentre = Math.sqrt(Math.pow(OffsetFromCentrePosIfNoRotation.x, 2) + Math.pow(OffsetFromCentrePosIfNoRotation.y, 2));
    if (OffsetFromCentrePosIfNoRotation.x < 0) DistanceFromCentre = 0 - DistanceFromCentre;
    var AngleFromCentreIfRotation = AngleFromCentreIfNoRotation - RotationAngle;
    var OffsetFromCentrePosIfRotation = { x: DistanceFromCentre * Math.cos(AngleFromCentreIfRotation), y: DistanceFromCentre * Math.sin(AngleFromCentreIfRotation) };
    var PosIfRotation = { x: CentrePosWithRotation.x + OffsetFromCentrePosIfRotation.x, y: CentrePosWithRotation.y + OffsetFromCentrePosIfRotation.y };
    return PosIfRotation;
}
GraphOnMap.prototype.ConvertCoordsToCompensateForTilt = function (coords, tiltAngle) {
    var CentrePos = { x: $("#" + this.ContainerDivId + "_mapcontainer").width() / 2, y: $("#" + this.ContainerDivId + "_mapcontainer").height() / 2 };
    var OffsetFromCentre = { x: coords.x - CentrePos.x, y: coords.y - CentrePos.y };
    var OffsetFromCentreAfterTilt = { x: OffsetFromCentre.x, y: OffsetFromCentre.y / Math.cos(tiltAngle) };
    var AbsolutePosFromCorner = { x: CentrePos.x + OffsetFromCentreAfterTilt.x, y: CentrePos.y + OffsetFromCentreAfterTilt.y };
    return AbsolutePosFromCorner;
}
GraphOnMap.prototype.ConvertCoordsToCompensateForTiltAndRotation = function (coords) {
    var tiltAngle = this.rotateX / 180 * Math.PI;
    var rotationAngle = this.rotateZ / 180 * Math.PI;
    var pos = { x: coords.x - $("#" + this.ContainerDivId + "_MapAndGraphContainer").offset().left, y: coords.y - $("#" + this.ContainerDivId + "_MapAndGraphContainer").offset().top };
    pos.x -= parseFloat($("#" + this.ContainerDivId + "_mapcontainer").css("left"));
    pos.y -= parseFloat($("#" + this.ContainerDivId + "_mapcontainer").css("top"));
    pos = this.ConvertCoordsToCompensateForTilt(pos, tiltAngle);
    pos = this.ConvertCoordsToCompensateForRotation(pos, rotationAngle);
    return pos;
}
GraphOnMap.prototype.OnWheel = function (event) {
	this.stopAutoRotate = true;
    var pos = this.ConvertCoordsToCompensateForTiltAndRotation({ x: event.pageX, y: event.pageY });
    var CentrePos = { x: $("#" + this.ContainerDivId + "_mapcontainer").width() / 2, y: $("#" + this.ContainerDivId + "_mapcontainer").height() / 2 };
    this.map.panBy(pos.x - CentrePos.x, pos.y - CentrePos.y);
    if (event.originalEvent.wheelDelta > 0) {
            this.map.setZoom(this.map.getZoom() + 1);
    } else {
        this.map.setZoom(this.map.getZoom() - 1);
    }
    this.DrawGraph();
}
GraphOnMap.prototype.OnPlainDrag = function (event, xMove, yMove) {
    var angle = this.rotateZ / 180 * Math.PI;
    var tilt = this.rotateX / 180 * Math.PI;
    yMove = (yMove / Math.cos(tilt));
    var mapX = 0;
    var mapY = 0;
    mapX = yMove * Math.sin(angle);
    mapY = yMove * Math.cos(angle);
    mapX += xMove * Math.cos(angle);
    mapY -= xMove * Math.sin(angle);
    this.map.panBy(mapX, mapY);
    this.DrawGraph();
}
GraphOnMap.prototype.OnShiftDrag = function (event, xMove, yMove) {
    this.RotateAndTilt(xMove, yMove);
}
GraphOnMap.prototype.AdjustEventToHandleTouchscreen = function(event){
    if (event.originalEvent.touches) {
        if (event.originalEvent.touches.length == 1) {
            event.pageX = event.originalEvent.touches[0].pageX;
            event.pageY = event.originalEvent.touches[0].pageY;
        }
        if (event.originalEvent.touches.length == 2) {
            event.pageX = event.originalEvent.touches[1].pageX - event.originalEvent.touches[0].pageX;
            event.pageY = event.originalEvent.touches[1].pageY - event.originalEvent.touches[0].pageY;
            event.shiftKey = true;
        }
    }
    return event;
}
GraphOnMap.prototype.OnDrag = function (event) {
	this.stopAutoRotate = true;
	event = this.AdjustEventToHandleTouchscreen(event);
    var xMove = this.lastDragX - event.pageX;
    var yMove = this.lastDragY - event.pageY;
    if (event.shiftKey) {
        this.OnShiftDrag(event, xMove, yMove);
    } else {
        this.OnPlainDrag(event, xMove, yMove);
    }
	this.lastDragX = event.pageX;
	this.lastDragY = event.pageY;
}
GraphOnMap.prototype.OnDragEnd = function(event) {
}
GraphOnMap.prototype.RotateAndTilt = function (angleRotate, angleTilt) {
    var newX = this.rotateX + angleTilt;
    if ((newX >= 0) && (newX < 75)) this.rotateX = newX;
    this.rotate(angleRotate, angleTilt);
}
GraphOnMap.prototype.rotate = function(angle, angleTilt) {
    if((angle != 0)||(angleTilt)) this.ClearGraph();
	this.rotateZ += angle;
	var cssVal = " rotateX(" + this.rotateX + "deg) rotateZ(" + this.rotateZ + "deg) ";
	$("#" + this.ContainerDivId + "_mapcontainer").css("transform", cssVal);
	$("#" + this.ContainerDivId + "_mapcontainer").css("-ms-transform", cssVal);
	$("#" + this.ContainerDivId + "_mapcontainer").css("-webkit-transform", cssVal);
	if ((angle != 0) || (angleTilt)) this.DrawGraph();
}
GraphOnMap.prototype.PrecalculateTranslationVariables = function(){
	this.MapCentrePoint = { x: $("#" + this.ContainerDivId + "_mapcontainer").width() / 2, y: $("#" + this.ContainerDivId + "_mapcontainer").height() / 2 };
	this.CanvasCentrePoint = { x: $("#" + this.ContainerDivId + "_GraphCanvas").width() / 2, y: $("#" + this.ContainerDivId + "_GraphCanvas").height() / 2 };
	this.TiltAngle = this.rotateX / 180 * Math.PI;
	this.CosTiltAngle = Math.cos(this.TiltAngle);
	this.RotationAngle = this.rotateZ / 180 * Math.PI;
	this.CosRotationAngle = Math.cos(this.RotationAngle);
	this.SinRotationAngle = Math.sin(this.RotationAngle);
}
GraphOnMap.prototype.TranslateLatLongToAbsolutePosition = function(lat, long) {
	var latLong = new google.maps.LatLng(lat, long);
	var MapAbsPosition = this.projection.fromLatLngToContainerPixel(latLong);
	var MapOffsetCentrePosition = {x: MapAbsPosition.x - this.MapCentrePoint.x, y:MapAbsPosition.y - this.MapCentrePoint.y};
	var RotatedMapOffsetCentrePosition = {x:(MapOffsetCentrePosition.x * this.CosRotationAngle - MapOffsetCentrePosition.y * this.SinRotationAngle), y: (MapOffsetCentrePosition.y * this.CosRotationAngle + MapOffsetCentrePosition.x * this.SinRotationAngle)};
	/*Add tilt here*/
	var CanvasOffsetCentrePosition = {x: RotatedMapOffsetCentrePosition.x, y: RotatedMapOffsetCentrePosition.y * this.CosTiltAngle};
	var CanvasPosition = {left: this.CanvasCentrePoint.x + CanvasOffsetCentrePosition.x, top: this.CanvasCentrePoint.y + CanvasOffsetCentrePosition.y};
	/*convert to absolute coords.*/
	CanvasPosition.top += this.CanvasPosition.top;
	CanvasPosition.left += this.CanvasPosition.left;
	return CanvasPosition;
}
/*Calculates the pixel positons of one lot/lan point.*/
GraphOnMap.prototype.CalculatePxPositions = function (log, plot) {
    var pos = this.TranslateLatLongToAbsolutePosition(log.lat, log.lon);
    var posData = new Object();
    posData.LineHeight = (log[plot.propertyToPlot] + plot.yAxisOffset) * plot.scale;
    posData.LineRenderHeight = posData.LineHeight * this.DrawLineHeightTiltCompensation;
    posData.LineBaseAbsPxPosition = { left: pos.left - this.CanvasPosition.left, top: pos.top - this.CanvasPosition.top };
    posData.LineTopAbsPxPosition = { left: posData.LineBaseAbsPxPosition.left, top: posData.LineBaseAbsPxPosition.top - posData.LineRenderHeight };
    posData.ShadowLineTopAbsPxPosition = { left: posData.LineBaseAbsPxPosition.left + posData.LineHeight * this.shadowLeftRatio, top: posData.LineBaseAbsPxPosition.top + posData.LineHeight * this.shadowTopRatio };
    log[plot.propertyToPlot + "_posData"] = posData;
}
GraphOnMap.prototype.DrawGlassShadow = function (plot) {
    if (!plot.drawShadow) return;
    if (this.DataSets[plot.dataSetIndex].data.length < 1) return;
    var ctx = this.ctx;
    ctx.fillStyle = plot.shadowFillStyle;
    var log = this.DataSets[plot.dataSetIndex].data[0];
    var lastPos = log[plot.propertyToPlot + "_posData"];
    for (var i = 1; i < this.DataSets[plot.dataSetIndex].data.length; i+= this.PlotStepSize()) {
        ctx.beginPath();
        log = this.DataSets[plot.dataSetIndex].data[i];
        posData = log[plot.propertyToPlot + "_posData"];
        ctx.moveTo(lastPos.ShadowLineTopAbsPxPosition.left, lastPos.ShadowLineTopAbsPxPosition.top);
        ctx.lineTo(posData.ShadowLineTopAbsPxPosition.left, posData.ShadowLineTopAbsPxPosition.top);
        ctx.lineTo(posData.LineBaseAbsPxPosition.left, posData.LineBaseAbsPxPosition.top);
        ctx.lineTo(lastPos.LineBaseAbsPxPosition.left, lastPos.LineBaseAbsPxPosition.top);
        ctx.closePath();
        ctx.fill();
        lastPos = posData;
    }
}
GraphOnMap.prototype.DrawTopLine = function (plot) {
    if (this.DataSets[plot.dataSetIndex].data.length < 1) return;
    var ctx = this.ctx;
    ctx.strokeStyle = plot.strokeStyle;
    ctx.lineWidth = 2;
    ctx.beginPath();
    var log = this.DataSets[plot.dataSetIndex].data[0];
    var posData = log[plot.propertyToPlot + "_posData"];
    ctx.moveTo(posData.LineTopAbsPxPosition.left, posData.LineTopAbsPxPosition.top);
    for (var i = 1; i < this.DataSets[plot.dataSetIndex].data.length; i+= this.PlotStepSize()) {
        log = this.DataSets[plot.dataSetIndex].data[i];
        posData = log[plot.propertyToPlot + "_posData"];
        ctx.lineTo(posData.LineTopAbsPxPosition.left, posData.LineTopAbsPxPosition.top);
    }
    ctx.stroke();
}
GraphOnMap.prototype.DrawBaseLine = function (plot) {
    if (this.DataSets[plot.dataSetIndex].data.length < 1) return;
    var ctx = this.ctx;
    ctx.strokeStyle = plot.baseLineStrokeStyle;
    ctx.beginPath();
    var log = this.DataSets[plot.dataSetIndex].data[0];
    var posData = log[plot.propertyToPlot + "_posData"];
    ctx.moveTo(posData.LineBaseAbsPxPosition.left, posData.LineBaseAbsPxPosition.top);
    for (var i = 1; i < this.DataSets[plot.dataSetIndex].data.length; i+= this.PlotStepSize()) {
        log = this.DataSets[plot.dataSetIndex].data[i];
        posData = log[plot.propertyToPlot + "_posData"];
        ctx.lineTo(posData.LineBaseAbsPxPosition.left, posData.LineBaseAbsPxPosition.top);
    }
    ctx.stroke();
}
GraphOnMap.prototype.DrawGlass = function (plot) {
    if (!plot.drawGlass) return;
    if (this.DataSets[plot.dataSetIndex].data.length < 1) return;
    var ctx = this.ctx;
    ctx.fillStyle = plot.fillStyle;
    var log = this.DataSets[plot.dataSetIndex].data[0];
    var lastPos = log[plot.propertyToPlot + "_posData"];
    for (var i = 1; i < this.DataSets[plot.dataSetIndex].data.length; i+= this.PlotStepSize()) {
        ctx.beginPath();
        log = this.DataSets[plot.dataSetIndex].data[i];
        posData = log[plot.propertyToPlot + "_posData"];
        ctx.moveTo(lastPos.LineTopAbsPxPosition.left, lastPos.LineTopAbsPxPosition.top);
        ctx.lineTo(posData.LineTopAbsPxPosition.left, posData.LineTopAbsPxPosition.top);
        ctx.lineTo(posData.LineBaseAbsPxPosition.left, posData.LineBaseAbsPxPosition.top);
        ctx.lineTo(lastPos.LineBaseAbsPxPosition.left, lastPos.LineBaseAbsPxPosition.top);
        ctx.closePath();
        ctx.fill();
       lastPos = posData;
    }
}
GraphOnMap.prototype.GetDataSetIndexById = function(id)
{
	for(var i=0; i < this.DataSets.length; i++){
	if(this.DataSets[i].id == id) return i;
	}
	console.debug("Error, the data set '" + id + "' does not exist.");
	return null;
}
GraphOnMap.prototype.DrawPlot = function(plotIndex){
		this.lastPos = 0;
		this.ctx = this.canvas.getContext("2d");
		this.CanvasPosition = $("#" + this.ContainerDivId + "_GraphCanvas").offset();
        var plot = this.Plots[plotIndex];
		plot.dataSetIndex = this.GetDataSetIndexById(plot.dataset);
		var dataSetIndex = plot.dataSetIndex;
		this.DrawLineHeightTiltCompensation = Math.sin(this.rotateX / 180 * Math.PI);
		this.lastPosData = 0;
		this.PrecalculateTranslationVariables();
		for (var i = 0; i < this.DataSets[dataSetIndex].data.length; i++) {
		    this.CalculatePxPositions(this.DataSets[dataSetIndex].data[i], plot);
		}
		this.DrawBaseLine(plot);
		/*this.DrawGlassShadow(plot, true);*/
		this.DrawGlass(plot, true);
		this.DrawTopLine(plot);
}
GraphOnMap.prototype.DrawGraphCounter = 0;
GraphOnMap.prototype.DrawGraph = function(){
	var ThisDrawGraphCounter = this.DrawGraphCounter++;
	this.projection = this.overlay.getProjection();
	this.ClearGraph();
	this.canvas = document.getElementById(this.ContainerDivId + "_GraphCanvas");
	for(var p=0; p< this.Plots.length; p++){
		this.DrawPlot(p);
	}
	$("#" + this.ContainerDivId + "").mousemove(function(event) {
	this.HandleMouseMove(event);
	}.bind(this));
}
GraphOnMap.lastTime = 0
GraphOnMap.Time = function(title){
	var now = new Date().getTime();
	if((GraphOnMap.lastTime != 0) && (typeof title != "undefined")){
		console.log(title + ": " + (now - GraphOnMap.lastTime));
	}
	GraphOnMap.lastTime = now;
}
GraphOnMap.prototype.HideDataPoint = function () {
    $("#" + this.ContainerDivId + "_DataPointHelper").hide();
}
GraphOnMap.prototype.HandleMouseMove = function(event) {
	var x = event.pageX;
	var y = event.pageY;
	var canvasPos = $("#" + this.ContainerDivId + "_GraphCanvas").offset();
	/*if we're moving the mouse while it's in the middle of a redraw, it won't find the canvas*/
	if(typeof canvasPos == "undefined") return;
	x -= canvasPos.left; 
	y -= canvasPos.top; 
    var minDistance = 9999999999;
	var closestLog = null;
	for(var p=0; p < this.Plots.length; p++){
		var plot = this.Plots[p];
		dataSet = this.DataSets[plot.dataSetIndex].data;
		for(var i=0; i < dataSet.length; i++){
			var log = dataSet[i];
              
			if(typeof log[plot.propertyToPlot + "_posData"] != "undefined"){
              
				var topPoint = log[plot.propertyToPlot + "_posData"].LineTopAbsPxPosition;
				var dist = Math.pow(topPoint.left - x, 2) + Math.pow(topPoint.top - y, 2);
				if(dist < minDistance){
					chosenPlot = plot;
					closestLog = log;
					minDistance = dist;
				}
			}
		}
	}
	if(minDistance < 10000){
		$("#" + this.ContainerDivId + "_DataPointHelper").css("left", closestLog[chosenPlot.propertyToPlot + "_posData"].LineTopAbsPxPosition.left-5);
		$("#" + this.ContainerDivId + "_DataPointHelper").css("top", closestLog[chosenPlot.propertyToPlot + "_posData"].LineTopAbsPxPosition.top-5);
		var textDisplay = chosenPlot.textDisplayTemplate.replace("{textDisplayProperty}", (Math.round(closestLog[chosenPlot.textDisplayProperty]* 100) / 100));
		$("#" + this.ContainerDivId + "_DataPointHelperInner").html(textDisplay);
		$("#" + this.ContainerDivId + "_DataPointHelperIcon").css("border-color", chosenPlot.strokeStyle);
		$("#" + this.ContainerDivId + "_DataPointHelper").show();
		}else{
		$("#" + this.ContainerDivId + "_DataPointHelper").hide();
	}
}
GraphOnMap.prototype.DrawGraphStart = function() {
	this.overlay = new google.maps.OverlayView();
	this.overlay.draw = function () { };
	this.overlay.setMap(this.map);
	google.maps.event.addListenerOnce(this.map, 'idle', function () {
			this.DrawGraph();
			this.AutoRotate();
	}.bind(this));
}
GraphOnMap.prototype.CanvasWidth = function () {
    return $("#" + this.ContainerDivId + "").offset().left + $("#" + this.ContainerDivId + "").width() - $("#" + this.ContainerDivId + "_MainContainer").offset().left;
}
GraphOnMap.prototype.CanvasHeight = function () {
    return $("#" + this.ContainerDivId + "").offset().top + $("#" + this.ContainerDivId + "").height() - $("#" + this.ContainerDivId + "_MainContainer").offset().top;
}
GraphOnMap.prototype.ClearGraph = function(){
	$("#" + this.ContainerDivId + "_GraphCanvasContainer").html('<canvas id="' + this.ContainerDivId + '_GraphCanvas" width="' + this.CanvasWidth() + '" height="' + this.CanvasHeight() + '"></canvas>');
	this.HideDataPoint();
}
