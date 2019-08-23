(function () {

	//psuedo global variables

	//range of years for all data
	var years = [1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];


	//array of first part of data column field names 
	var selectData = ["CO2_", "gdpCountry_", "popGrowth_"];

	//Shane's functions use the selectData array index + selected //year to access data for table, slider, and dropdown menu

	var defaultYear = years.slice(-1)[0];
	var co2Year = selectData[0] + defaultYear; // the CO2 data column name 

	//array for dropdown, matches covariate data in selectData
	var attrArray = ["GDP", "Pop Growth"]

	//current selection from attribute array
	var expressed = attrArray[0]

	window.onload = getData();

	//import data using promsies method
	function getData() {

		var countryJSON = "data/countries.topojson"
		var countryCentroids = "data/country_centroids_az8.csv"
		var combinedData = "data/combinedData.geojson"
		var populationDensity = "data/popDensity.csv"
		var combinedTopojson = "data/combinedData.topojson"

		Promise.all([d3.json(countryJSON),
					d3.csv(countryCentroids),
					d3.json(combinedData),
					d3.csv(populationDensity),
					d3.json(combinedTopojson)]).then(function (data) {



			//main geojson of world countries
			var countries = data[0];

			//csv of country centers for table zoom to location 
			var countryCenter = data[1];

			//geojson with C02 and other data 
			var combined = data[2];

			//population density data
			var popDensity = data[3];

			var combinedTopo = data[4];

			//join population Density to rest of data
			combined = joinPopDens(combined, popDensity)

			var topo = topojson.feature(combinedTopo, combinedTopo.objects.combinedData);

			//convert countries to geojson using topojson.js
			var world = topojson.feature(countries, countries.objects.countries);

			//join with combined data (if needed)
			world = joinData(world, combined)


			//set up default year on page open 
			//			$("#year").text("2014");
			$('#year').html("<h2>2014</h2>");
			//add initial panel information on first load
			$("#selected-info").html('<h3>CO2 and GDP</h3>');
			$("#details").html('<i class="fas fa-info"></i><h6>There is a strong correlation between CO2 emissions and GDP per capita. Countries with higher GDP tend to have higher energy production and emit more CO2</h6>');

			//set up initial year for page open
			var selectedYear = selectData[1] + defaultYear;
			console.log(selectedYear)

			//initialize map 
			var map = setMap(world, countryCenter, topo, selectedYear);

			//call other functions 
			createDropdown(combined, map, countryCenter, world);
			createSequenceControls(combined, map, countryCenter, world);
			setTable(combined, co2Year, selectedYear, map, countryCenter, world, topo);
			addLegend(world);

		})

	}

	function setMap(world, countryCenter, topo, selectedYear) {

		var CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd',

		});


		var map = new L.Map("map", {
			center: new L.LatLng(37.8, -96),
			zoom: 4,
			minZoom: 1.5,
			zoomControl: false
		})

		map.addLayer(CartoDB_Positron);


		map.createPane('labels');
		map.getPane('labels').style.zIndex = 650;
		var CartoDB_PositronOnlyLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
			subdomains: 'abcd',
			maxZoom: 19,
			pane: 'labels'

		});


		map.addLayer(CartoDB_PositronOnlyLabels)
		CartoDB_PositronOnlyLabels.bringToFront();


		//add reset zoom feature 
		var resetZoom = new L.Control.ZoomMin()
		map.addControl(resetZoom)

		//add search control feature to map
		var searchLayer = L.geoJson(topo)
		var search = new L.Control.Search({
			layer: searchLayer,
			propertyName: 'Country Name',
			hideMarkerOnCollapse: true
		})
		map.addControl(search)

		zoomFromTable(map, countryCenter, world);

		var expressed = "GDP"
		//intialize d3 svg map overlay
		var co2color = co2ColorScale(world, co2Year);
		var selectedColor = selectedColorScale(world, selectedYear, expressed)
		d3MapLayer(map, world, selectedYear, co2color, selectedColor)


		return map

	} //end setMap

	//takes variable data and returns color scale using Natural Breaks
	function selectedColorScale(world, selectedYear, expressed) {
		//reject null values in array. geoseries doesn't like them
		var domainArray = [];
		for (var i = 0; i < world.features.length; i++) {
			var val = parseFloat(world.features[i].properties[selectedYear]);
			if (!isNaN(val)) {
				domainArray.push(val);
			}
		}

		//get Natural break (jenks) values using geostats.js 
		var geoSeries = new geostats(domainArray);

		var jenks = geoSeries.getClassJenks(9);
		jenks.shift();

		//use natural breaks jenks function as choropleth's domain value breaks
		var color = d3.scaleThreshold()
			.domain(jenks)

		//match expression with data selection to update selectedYear
		if (expressed == "GDP") {
			color.range(d3.schemeGreens[9])
		} else if (expressed == "Pop Growth") {
			color.range(d3.schemeBlues[9])
		}

		return color
	} //end of makeColorScale	

	function co2ColorScale(world, co2Year) {
		//reject null values in array. geoseries doesn't like them
		var domainArray = [];
		for (var i = 0; i < world.features.length; i++) {
			var val = parseFloat(world.features[i].properties[co2Year]);
			if (!isNaN(val)) {
				domainArray.push(val);
			}
		}

		//get Natural break (jenks) values using geostats.js 
		var geoSeries = new geostats(domainArray);

		var jenks = geoSeries.getClassJenks(9);
		jenks.shift();

		//use natural breaks jenks function as choropleth's domain value breaks
		var color = d3.scaleThreshold()
			.domain(jenks)
			.range(d3.schemeReds[9]);

		return color
	} //end of makeColorScale


	//function to test for data value and return color
	function selectedChoropleth(props, selectedColor) {
		//make sure attribute value is a number
		var val = parseFloat(props);
		//if attribute value exists, assign a color; otherwise assign gray
		if (typeof val == 'number' && !isNaN(val)) {
			return selectedColor(val);
		} else {
			return "transparent";
		}
	} // end of choropleth	

	//function to test for data value and return color
	function co2Choropleth(props, co2color) {
		//make sure attribute value is a number
		var val = props;
		//if attribute value exists, assign a color; otherwise assign gray
		if (typeof val == 'number' && !isNaN(val)) {
			return co2color(val);
		} else {
			return "transparent";
		}
	} // end of choropleth


	function d3MapLayer(map, world, selectedYear, co2color, selectedColor) {
		//d3 method 1 to add geojson to map
		var svg = d3.select(map.getPanes().overlayPane).append("svg"),
			g1 = svg.append("g").attr("class", "leaflet-zoom-hide"),
			g2 = svg.append("g").attr("class", "leaflet-zoom-hide");


		function projectPoint(x, y) {
			var point = map.latLngToLayerPoint(new L.LatLng(y, x));
			this.stream.point(point.x, point.y);
		}
		var transform = d3.geoTransform({
				point: projectPoint
			}),
			path = d3.geoPath().projection(transform)

		var bounds = path.bounds(world),
			topLeft = bounds[0],
			bottomRight = bounds[1];

		svg.attr("width", bottomRight[0] - topLeft[0])
			.attr("height", bottomRight[1] - topLeft[1])
			.style("left", topLeft[0] + "px")
			.style("top", topLeft[1] + "px");


		g1.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");

		g2.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");


		var feature1 = g1.selectAll("path")
			.attr("class", "world1")
			.data(world.features)
			.enter()
			.append("path")
			.attr("class",
				function (d) {
					return "feature1 " + d.properties.ADMIN;
				})
			.style("stroke", "white")
			.style("opacity", .8)
			.attr("fill",
				function (d) {
					return selectedChoropleth(d.properties["gdpCountry_2014"], selectedColor);
				})

		var feature2 = g2.selectAll("path")
			.attr("class", "world2")
			.data(world.features)
			.enter()
			.append("path")
			.attr("class",
				function (d) {
					return "feature2 " + d.properties.ADMIN;
				})
			.style("stroke", "white")
			.style("opacity", .5)
			.attr("fill",
				function (d) {
					return co2Choropleth(d.properties["CO2_2014"], co2color);
				})

		feature1.attr("d", path);
		feature2.attr("d", path);

		map.on('move', update);

		function update() {
			feature1.attr("d", path);
			feature2.attr("d", path);

		}
	}


	//use jquery to assign each country to table row
	function setTable(selected, co2Year, selectedYear, map, countryCenter, world) {

		//update table head with selected data 
		$('#selected').html(expressed);

		//initialize empty variable for table 
		var tableData = '';

		//jquery each assigns data for selected Year and attriutes to new table
		$.each(selected.features, function (key, value) {
			tableData += '<tr scope="row">';
			tableData += '<td class="country-name">' + value.properties["Country Name"] + '</td>';
			tableData += '<td class="co2">' + Math.round(value.properties[co2Year] * 100) / 100 + '</td>';
			tableData += '<td class="selected">' + Math.round(value.properties[selectedYear] * 100) / 100 + '</td>';

			tableData += '<tr>';
		});

		//add table to page element
		$("#table").empty();
		$('#table').prepend(tableData);

		//re-call zoomFromTable so when user clicks on country name it zooms to country selected 
		zoomFromTable(map, countryCenter, world)
	}


	//zooms to location based on user selection in table
	function zoomFromTable(map, csvData, world) {


		$('.country-name').click(function () {
			var $item = $(this).text();
			for (var i = 0; i < csvData.length; i++) {
				if (csvData[i].ADMIN == $item) {
					var array = [];
					var lat = parseFloat(csvData[i].Latitude);
					var long = parseFloat(csvData[i].Longitude);
					array.push(lat, long);
					map.flyTo(array);

				}
			}

		})
		$('.country-name').dblclick(function () {
			map.setZoom(4);
		})
	}


	function joinData(location, csvData) {

		//loop through csv to assign each set of csv attribute values to geojson region
		for (var i = 0; i < csvData.features.length; i++) {
			var csvRegion = csvData.features[i].properties;
			var csvKey = csvRegion["Country Code"];

			//loop through geojson regions to find correct region
			for (var a = 0; a < location.features.length; a++) {

				var geojsonProps = location.features[a].properties;
				var geojsonKey = geojsonProps.ISO_A3;

				if (geojsonKey == csvKey) {

					var val = Object.entries(csvRegion);
					for (var v = 0; v < val.length; v++) {
						for (var v = 0; v < val.length; v++) {
							var value = Object.values(val[v]);
							geojsonProps[value[0]] = value[1];

						}
					}
				}

			}

		}
		return location
	}

	function joinPopDens(combined, popDensity) {

		//loop through csv to assign each set of csv attribute values to geojson region
		for (var i = 0; i < popDensity.length; i++) {
			var csvRegion = popDensity[i]; //the current region
			var csvKey = csvRegion["Country Code"]; //the CSV primary key

			//loop through geojson regions to find correct region
			for (var a = 0; a < combined.features.length; a++) {

				var geojsonProps = combined.features[a].properties;

				//the current region geojson properties
				var geojsonKey = geojsonProps["Country Code"]; //the geojson primary key

				//where primary keys match, transfer csv data to geojson properties object
				if (geojsonKey == csvKey) {

					var val = Object.entries(popDensity[i])
					for (var v = 0; v < val.length; v++) {
						var value = Object.values(val[v])

						geojsonProps[value[0]] = value[1];
					}
				}
			}
		}
		return combined
	}


	//function to create a dropdown menu for attribute selection

	function createDropdown(combined, map, countryCenter, world) {

		//add select element
		var dropdown = d3.select("#filter")
			.append("select")
			.attr("class", "select-var")
			.on("change", function () {
				changeAttribute(this.value, combined, map, countryCenter, world)
			});



		//add attribute name options
		var attrOptions = dropdown.selectAll("attrOptions")
			.data(attrArray)
			.enter()
			.append("option")
			.attr("value", function (d) {
				return d
			})
			.text(function (d) {
				return d
			});

	}; //end of createDropdown

	//change map, table, and chart based on user selection
	function changeAttribute(attribute, combined, map, countryCenter, world) {

		//change expressed to selected attribute
		expressed = attribute
		defaultYear = $("#year").text();
		co2Year = selectData[0] + defaultYear;

		//match expression with data selection to update selectedYear
		if (expressed == "GDP") {
			var selectedYear = selectData[1] + defaultYear;
			$("#selected-info").html('<h3>CO2 and GDP</h3>');
			$("#details").html('<i class="fas fa-info"></i><h6>There is a strong correlation between CO2 emissions and GDP per capita. Countries with higher GDP tend to have higher energy production and emit more CO2</h6>');


		} else if (expressed == "Pop Growth") {
			var selectedYear = selectData[2] + defaultYear;
			//add initial panel information on first load
			$("#selected-info").html('<h3>CO2 and Population Growth</h3>');
			$("#details").html('<i class="fas fa-info"></i><h6>More people on the planet means more resources are being consumed.  Population growth is strongly linked to CO2 emissions and each additional human contributes to increased global warming.</h6>');
		}


		//reset table based on user selection in dropdown 
		setTable(combined, co2Year, selectedYear, map, countryCenter)

		//recreate the color scale
		var colorScale = selectedColorScale(world, selectedYear, expressed);

		//call function to update map 
		//recolor map based on user selection
		var feature1 = d3.selectAll(".feature1");

		feature1.attr("fill", function (d) {
			return selectedChoropleth(d.properties[selectedYear], colorScale);
		})

		//update legend
		var low = d3.selectAll('.selected-low');
		var medium = d3.selectAll('.selected-medium');
		var high = d3.selectAll('.selected-high');
		var legendSelect = d3.selectAll('.legend-select');

		legendSelect.text(expressed)



		if (expressed == "GDP") {
			low.attr("fill", "#F0F9EC");
			medium.attr("fill", "#7BC77E");
			high.attr("fill", "#00451C");
		} else if (expressed == "Pop Growth") {
			low.attr("fill", "#F1FAEE");
			medium.attr("fill", "#70B0D6");
			high.attr("fill", "#08326E");
		}

		$("#co2-best").html('<h5><b>Most: ' + '< /h5?');
		$("#co2-worst").html('<h5><b>Least: </b> </h5>');


		$("#selected-title").html('<h4>' + expressed + '</h4>');
		$("#selected-best").html('<h5><b>Best: </h5?');
		$("#selected-worst").html('<h5><b>Worst: </b> </h5>');


		//call function to update chart


	}

	//create sequence control slider options
	function createSequenceControls(combined, map, countryCenter, world) {

		//create range input element (slider)
		$('#slider').append('<input class="range-slider" type="range">');

		//set slider attributes
		$('.range-slider').attr({
			max: 54,
			min: 0,
			value: 54,
			step: 1
		});

		// create slider event handler
		$('.range-slider').on('input', function () {
			var index = $(this).val();
			$('#year').html(years[index]);
			$('#year').html("<h2>" + years[index] + "</h2>");

			//update C02 and selected varaiable by slider index selection
			var co2Year = selectData[0] + years[index]
			var selectedYear = selectYear(expressed, index)
			co2Year = selectData[0] + years[index];

			//recreate the color scale
			var colorScale = selectedColorScale(world, selectedYear, expressed);
			//call function to update map 
			//recolor map based on user selection
			var feature1 = d3.selectAll(".feature1");
			feature1.attr("fill", function (d) {
				return selectedChoropleth(d.properties[selectedYear], colorScale);
			})


			//update table based on slider index selection
			setTable(combined, co2Year, selectedYear, map, countryCenter)

		});

	}

	function selectYear(expressed, index) {

		if (expressed == "GDP") {
			var selectedYear = selectData[1] + years[index];
		} else if (expressed == "Pop Growth") {
			var selectedYear = selectData[2] + years[index];
		}
		return selectedYear
	}


	function addLegend(data) {

		var svgLegend = d3.select("#legend").append("svg").attr("width", 200)
			.attr("height", 300)
			.attr("class", "svg-legend");

		svgLegend.append("rect")
			.attr("x", 40)
			.attr("y", 20)
			.attr("width", 150)
			.attr("height", 150)
			.attr("fill", "transparent");

		svgLegend.append("text")
			.attr("x", 40)
			.attr("y", 180)
			.text("low")
		svgLegend.append("text")
			.attr("x", 140)
			.attr("y", 180)
			.text("high")
		svgLegend.append("text")
			.attr("x", 40)
			.attr("y", 200)
			.text("CO2 Emissions")

		svgLegend.append("text")
			.attr("x", 35)
			.attr("y", 165)
			.attr("transform", "rotate(-90,35,165)")
			.text("low")

		svgLegend.append("text")
			.attr("x", 35)
			.attr("y", 60)
			.attr("transform", "rotate(-90,35,60)")
			.text("high")

		svgLegend.append("text")
			.attr("x", 15)
			.attr("y", 140)
			.attr("transform", "rotate(-90,15,140)")
			.attr("class", "legend-select")
			.text("GDP")

		//co2 Legend
		var rect1 = svgLegend.append("rect")
			.attr("x", 40)
			.attr("y", 10)
			.attr("width", 50)
			.attr("height", 150)
			.attr("fill", "#FFF2EB")
			.style("opacity", .6);
		var rect2 = svgLegend.append("rect")
			.attr("x", 90)
			.attr("y", 10)
			.attr("width", 50)
			.attr("height", 150)
			.attr("fill", "#F96649")
			.style("opacity", .6);
		var rect3 = svgLegend.append("rect")
			.attr("x", 140)
			.attr("y", 10)
			.attr("width", 50)
			.attr("height", 150)
			.attr("fill", "#6F020E")
			.style("opacity", .6);


		//selected Legend
		var rect4 = svgLegend.append("rect")
			.attr("x", 40)
			.attr("y", 110)
			.attr("width", 150)
			.attr("height", 50)
			.attr("fill", "#F0F9EC")
			.attr("class", "selected-low")
			.style("opacity", .5);
		var rect5 = svgLegend.append("rect")
			.attr("x", 40)
			.attr("y", 60)
			.attr("width", 150)
			.attr("height", 50)
			.attr("fill", "#7BC77E")
			.attr("class", "selected-medium")
			.style("opacity", .5);
		var rect6 = svgLegend.append("rect")
			.attr("x", 40)
			.attr("y", 10)
			.attr("width", 150)
			.attr("height", 50)
			.attr("class", "selected-high")
			.attr("fill", "#00451C")
			.style("opacity", .5);
	}




})();
