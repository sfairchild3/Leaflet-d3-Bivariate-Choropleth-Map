/**psuedo-code for project
(note to collaborators- // in this section indicates completed)
//Part 1- load map and table with data
//1. create leaflet map
//2. add country layers with d3
//3. add csv data with d3
//4. add table element with csv data- jquery
//5. add map zoom function from table selection 
Part 2 - Map choropleth style and rexpression D3
1. style map 
2. create bivariate choropleth legend
3. create dropdown menu
4. reexpress map and legend based interactive user selection
Part 3- Create D3 chart for CO2 data and covariate
1. create chart area
2. add CO2 data as a line
3. add covariate data as a line
4. reexpress chart based on user selection
Part 4- Time slider- jquery method?
1. create time slider element
2. create time slider function based on years in CO2 emissions 
Part 5- Popups, tooltips, search control,  
**/

(function () {

		//psuedo global variables

		//range of years for all data
		var years = [1960, 1961, 1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977, 1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014];


		//array of first part of data column field names 
		var selectData = ["CO2_", "gdpCountry_", "popGrowth_", "popDens_"];

		//Shane's functions use the selectData array index + selected //year to access data for table, slider, and dropdown menu

		var defaultYear = years.slice(-1)[0];
		var co2Year = selectData[0] + defaultYear; // the CO2 data column name 

		//array for dropdown, matches covariate data in selectData
		var attrArray = ["GDP", "Pop Growth", "Pop Density"]

		//current selection from attribute array
		var expressed = attrArray[1]

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
				console.log(world)


				//set up default year on page open 
				//			$("#year").text("2014");
				//			$(".range-slider").text("2014");

				//set up initial year for page open
				var selectedYear = selectData[1] + defaultYear;

				//initialize map 
				var map = setMap(world, countryCenter, topo, selectedYear);

				//call other functions 
				createDropdown(combined, map, countryCenter);
				//			zoomFromTable(map, countryCenter, world, topo);
				createSequenceControls(combined, map, countryCenter);
				setTable(combined, co2Year, selectedYear, map, countryCenter, world, topo);

			})

		}

		function setMap(world, countryCenter, topo, selectedYear) {

			var baseMap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
				}),
				landMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
					attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
				});

			var map = L.map('map', {
				layers: [baseMap], // only add one!
				minZoom: 1,
				zoomControl: false
			}).setView([37.8, -96], 2, 1);

			var baseMaps = {
				"Basemap": baseMap,
				"Landscape": landMap
			};

			L.control.layers(baseMaps).addTo(map);



			//leaflet method to add geojson to map

			//		var worldLayer = L.geoJson(world)


			//		var popup = L.popup({
			//			closeButton: true,
			//			autoClose: true
			//		}).setLatLng(map.getBounds().getCenter()).setContent('<p class= mainPopup1><b>The Story:</b> This map contains CO2 emission, temperature, GDP, Population Growth, as well as Population data spanning most countries. The data ranges across 1960-2015 for the majority of the data set.</p><p class= mainPopup2><b>Popups:</B> When making a selection with your mouse pointer please be certain to click/hover over the area of interest to list the location and specific information.</p><p class= mainPopup3><b>Scrollbar:</b>This will allow you to pick from specific dates.</p><p class= mainPopup4><b>Aerial View:</b> There is also the option to change from the normal map view into an landscape view for those that are interested in the topography of the areas today</P>').openOn(map);

			//add reset zoom feature 
			var resetZoom = new L.Control.ZoomMin()
			map.addControl(resetZoom)

			var searchLayer = L.geoJson(topo)
			//
			//add search control feature to map
			var search = new L.Control.Search({
				layer: searchLayer,
				propertyName: 'Country Name',
				hideMarkerOnCollapse: true
			})
			map.addControl(search)

			zoomFromTable(map, countryCenter, world);


			//		L.geoJson(world, {
			//			style: style(world, selectedYear)
			//		}).addTo(map);

			//		worldLayer.addTo(map);

			//		var markersLayer = new L.LayerGroup(); //layer contain searched elements

			//intialize d3 svg map overlay
			var co2color = co2ColorScale(world, co2Year);
			var selectedColor = selectedColorScale(world, selectedYear)
			d3MapLayer(map, world, selectedYear, co2color, selectedColor)


			return map

		} //end setMap


		//takes variable data and returns color scale using Natural Breaks
		function selectedColorScale(world, selectedYear) {
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
				.range(d3.schemeOranges[9]);

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
				.range(d3.schemeBlues[9]);

			return color
		} //end of makeColorScale


		//function to test for data value and return color
		function selectedChoropleth(props, selectedColor) {
			//make sure attribute value is a number
			var val = props;
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


			//		var colorv1 = d3.scaleLinear()
			//			.domain([1, 10])
			//			.range(["#fee8c8", "#e34a33"]);
			//
			//		var colorv2 = d3.scaleLinear()
			//			.domain([1, 10])
			//			.range(["#deebf7", "#3182bd"]);

			//		var feature1 = g.selectAll("path")
			//			.attr("class", "world1")
			//			.data(world.features)
			//			.enter()
			//			.append("path")
			//			.style("stroke", "white")
			//			.style("opacity", .5)
			//			.attr("fill",
			//				function (d) {
			//					return choropleth(d.properties["CO2_2014"], colorScale);
			//				})

			var feature1 = g1.selectAll("path")
				.attr("class", "world1")
				.data(world.features)
				.enter()
				.append("path")
				.style("stroke", "white")
				.style("opacity", .5)
				.attr("fill",
					function (d) {
						return selectedChoropleth(d.properties[selectedYear], selectedColor);
					})

			var feature2 = g2.selectAll("path")
				.attr("class", "world1")
				.data(world.features)
				.enter()
				.append("path")
				.style("stroke", "white")
				.style("opacity", .5)
				.attr("fill",
					function (d) {
						return co2Choropleth(d.properties["CO2_2014"], co2color);
					})


			feature1.attr("d", path);
			feature2.attr("d", path);

			map.on('moveend', update);

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
				tableData += '<td class="co2">' + value.properties[co2Year] + '</td>';
				tableData += '<td class="selected">' + value.properties[selectedYear] + '</td>';
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


			$(".country-name").click(function () {
				var selected = $(this).hasClass("highlight");
				$(".country-name").removeClass("highlight");
				if (!selected)
					$(this).addClass("highlight");
			});

			$('.country-name').click(function () {
				var $item = $(this).text();

				for (var i = 0; i < csvData.length; i++) {
					if (csvData[i].ADMIN == $item) {
						var array = [];
						var lat = parseFloat(csvData[i].Latitude);
						var long = parseFloat(csvData[i].Longitude);
						array.push(lat, long);
						map.setZoom(4);
						map.panTo(array);

					}
				}

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
							var value = Object.values(val[v])
							geojsonProps[value[0]] = value[1]
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
							geojsonProps[value[0]] = value[1]

						}
					}
				}
			}
			return combined
		}


		//function to create a dropdown menu for attribute selection
		function createDropdown(combined, map, countryCenter) {

			//add select element
			var dropdown = d3.select("#filter")
				.append("select")
				.attr("class", "select-var")
				.on("change", function () {
					changeAttribute(this.value, combined, map, countryCenter)
				});

			//add initial option
			var titleOption = dropdown.append("option")
				.attr("class", "titleOption")
				.attr("disabled", "true")
				.text("Select");

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
		function changeAttribute(attribute, combined, map, countryCenter) {

			//change expressed to selected attribute
			expressed = attribute
			defaultYear = $("#year").text();
			co2Year = selectData[0] + defaultYear;


			//match expression with data selection to update selectedYear
			if (expressed == "GDP") {
				var selectedYear = selectData[1] + defaultYear;
			} else if (expressed == "Pop Growth") {
				var selectedYear = selectData[2] + defaultYear;
			} else if (expressed == "Pop Density") {
				var selectedYear = selectData[3] + defaultYear;
			}

			//reset table based on user selection in dropdown 
			setTable(combined, co2Year, selectedYear, map, countryCenter)

			//call function to update map 

			//call function to update chart
		}

		//create sequence control slider options
		function createSequenceControls(combined, map, countryCenter) {

			//create range input element (slider)
			$('#slider').append('<input class="range-slider" type="range">');

			//set slider attributes
			$('.range-slider').attr({
				max: 54,
				min: 0,
				value: 54,
				step: 1
			})


			// create slider event handler
			$('.range-slider').on('input', function () {
					var index = $(this).val();
					$('#year').html("<h1>" + years[index]) + "</h1>");


				//update C02 and selected varaiable by slider index selection
				var co2Year = selectData[0] + years[index]
				var selectedYear = selectYear(expressed, index)
				co2Year = selectData[0] + years[index];

				//update table based on slider index selection
				setTable(combined, co2Year, selectedYear, map, countryCenter)

			});

	}

	function selectYear(expressed, index) {

		if (expressed == "GDP") {
			var selectedYear = selectData[1] + years[index];
		} else if (expressed == "Pop Growth") {
			var selectedYear = selectData[2] + years[index];
		} else if (expressed == "Pop Density") {
			var selectedYear = selectData[3] + years[index];
		}

		return selectedYear

	}

})();
