"use strict";

let a;

// Data in 7 CSVs to load
let city_attributes, humidity, pressure, temperature, weather_description, wind_direction, wind_speed;
// Processed data, to be an array of 36 cities
let data;


// Join data onto an array of objects under a tag, parsing numbers if data is numeric
function joinData(original, data, tag="join", numeric=true) {
    for(const city of original) {
        city[tag] = [];
        city[tag + "Weekly"] = [];
        let sum = 0, points = 0;
        for(let i=0; i<data.length; i++) {
            const d = data[i];
            const point = numeric ? parseFloat(d[city["City"]]) || null : d[city["City"]];
            city[tag].push(point);
            if(i%168 === 0) {
                city[tag + "Weekly"][Math.floor(i/168)] = {
                    start: new Date(d["datetime"]),
                    average: 0,
                    data: []
                }
            }
            city[tag + "Weekly"][Math.floor(i/168)].data.push(point);
            if(i%168 === 167) {
                const mean = d3.mean(city[tag + "Weekly"][Math.floor(i/168)].data);
                city[tag + "Weekly"][Math.floor(i/168)].average = mean || city[tag + "Weekly"][Math.floor(i/168) - 1]?.average || 0;
            }
        }
        city[tag + "Weekly"][269].average = d3.mean(city[tag + "Weekly"][269].data) || city[tag + "Weekly"][268].average;
        // Compute an average of the data: either the mean of all valid numbers or mode of texts
        city[tag + "Average"] = numeric ? d3.mean(city[tag]) : d3.mode(city[tag]);
    }
}

// Look up a city from a latitude, necessary for selecting cities from markers
function getCityFromLat(lat) {
    for(const city of data) {
        if(parseFloat(city["Latitude"]) === lat) return city;
    }
    return null;
}

let graph; // Needs to be global

loadindicator.innerHTML = "Loading data...";

d3.dsv(",","city_attributes.csv")
    .then((d) => {
        city_attributes = d;
        return d3.dsv(",","humidity.csv")
    })
    .then((d) => {
        humidity = d;
        return d3.dsv(",","pressure.csv")
    })
    .then((d) => {
        pressure = d;
        return d3.dsv(",","temperature.csv")
    })
    .then((d) => {
        temperature = d;
        return d3.dsv(",","weather_description.csv")
    })
    .then((d) => {
        weather_description = d;
        return d3.dsv(",","wind_direction.csv")
    })
    .then((d) => {
        wind_direction = d;
        return d3.dsv(",","wind_speed.csv")
    })
    .then((d) => {
        wind_speed = d;

        loadindicator.innerHTML = "Processing data...";

        data = city_attributes;
        joinData(data, humidity, "humidity");
        joinData(data, pressure, "pressure");
        joinData(data, temperature, "temperature");
        joinData(data, weather_description, "weather_description", false);
        joinData(data, wind_direction, "wind_direction");
        joinData(data, wind_speed, "wind_speed");
        //console.log(data);

        var map = L.map('map').fitBounds([
            [50.5, -126.5],
            [25.2, -67.8]
        ]);

        var tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);

        function updateSnapshotBox(target,op=1) {
            snapshot.style.opacity = op;
            if(target == null) {
                snapshot.innerHTML = "<h1>Select a city to begin visualizing!</h1>";
                return 0;
            }
            snapshot.innerHTML = `
<h2>${target["City"]}, ${target["Country"]}</h2>
<p>Latitude:${target["Latitude"]}, Longitude:${target["Longitude"]}. Most common weather description: "${target["weather_descriptionAverage"]}".</p>
<ul>
<li><span class="clickable" onclick="graph('humidity')">Humidity (%)</span>&#9;(Average value: ${target["humidityAverage"].toFixed(0)})</li>
<li><span class="clickable" onclick="graph('pressure')">Atmpospheric Pressure (millibar)</span>&#9;(Average value: ${target["pressureAverage"].toFixed(0)})</li>
<li><span class="clickable" onclick="graph('temperature')">Temperature (K)</span>&#9;(Average value: ${target["temperatureAverage"].toFixed(1)})</li>
<!--<span class="clickable" onclick="graph('wind_direction')">Wind Direction</span>: ${target["wind_directionAverage"].toFixed(0)} degrees-->
<li><span class="clickable" onclick="graph('wind_speed')">Wind Speed (m/s)</span>&#9;(Average value: ${target["wind_speedAverage"].toFixed(1)})</li>
</ul>
<p>Click on a measurement to graph the weekly data!</p>
`;
        }

        let selectedCity = null;
        let selectedMeasure = null;

        for(const city of data) {
            L.marker([parseFloat(city["Latitude"]), parseFloat(city["Longitude"])])
                .addTo(map)
                .addEventListener("mouseover", function(e) {
                    if(selectedCity) return;
                    const target = getCityFromLat(e.latlng.lat);
                    updateSnapshotBox(target, 0.5);
                })
                .addEventListener("mouseout", function(e) {
                    if(selectedCity == null) updateSnapshotBox(null);
                })
                .addEventListener("click", function(e) {
                    detail.innerHTML = "";
                    if(selectedCity == getCityFromLat(e.latlng.lat)) {
                        selectedCity = null;
                        updateSnapshotBox(null);
                    }
                    else {
                        selectedCity = getCityFromLat(e.latlng.lat);
                        updateSnapshotBox(selectedCity)
                    }
                });
        }

        const tooltip = d3.select("body")
            .append("div")
            .attr("id", "tooltip")
            .style("position", "absolute")
            .style("z-index", 10)
            .style("opacity", 0)
            .style("background-color", "white")
            .style("border", "1px solid black")
            .style("left", "0px")
            .style("padding", "5px")
            .style("top", "0px");

        graph = function(measure) {
            // copy and trim the ends
            const inData = selectedCity[measure + "Weekly"];
            let weeklyData = [];
            for(let i=1; i<inData.length-1; i++) {
                let dailyData = [];
                for(let j=0; j<168; j++) {
                    dailyData.push({
                        hour: j + 1,
                        value: inData[i].data[j] || inData[i].average
                    });
                }
                weeklyData.push({
                    start: new Date(inData[i].start),
                    average: inData[i].average,
                    dailyData: dailyData
                });
            }

            const width = 650, height = 300, margin = 30;

            const x = d3.scaleUtc(d3.extent(weeklyData, d => d.start), [margin, width - margin]).nice();
            const y = d3.scaleLinear(d3.extent(weeklyData, d => d.average), [height - margin, margin]);

            const startX = x(weeklyData[0].start);
            const endX = x(weeklyData[weeklyData.length - 1].start);
            console.log(startX,endX);

            const line = d3.line()
                .x(d => x(d.start))
                .y(d => y(d.average));

            const svg = d3.create("svg")
                .attr("id", "mysvg")
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", [0, 0, width, height])
                .attr("style", "max-width: 100%; height: 100%; height: intrinsic;");

            svg.append("g")
                .attr("transform", `translate(0,${height - margin})`)
                .call(d3.axisBottom(x).ticks(5));

            svg.append("g")
                .attr("transform", `translate(${margin},0)`)
                .call(d3.axisLeft(y).ticks(10))
                .call(g => g.select(".domain").remove())
                .call(g => g.selectAll(".tick line").clone()
                    .attr("x2", width - margin - margin)
                    .attr("stroke-opacity", 0.1))
                .call(g => g.append("text")
                    .attr("x", -margin)
                    .attr("y", 10)
                    .attr("fill", "currentColor")
                    .attr("text-anchor", "start")
                    .text("↑ " + measure));

            svg.append("path")
                .attr("fill", "none")
                .attr("stroke", "green")
                .attr("stroke-width", 2)
                .attr("d", line(weeklyData));

            svg.append("g")
                .selectAll()
                .data(weeklyData)
                .enter()
                .append("rect")
                .attr("x", function(d,_i) { return x(d.start) - 1; })
                .attr("y", function(d,_i) { return y(d.average) - 10; })
                .attr("width", 2)
                .attr("height", 20)
                .attr("opacity", 0)
                .on("mouseover", function(e,data) {
                    tooltip.style("opacity", 1);
                    tooltip.style("left", e.x - 200 - 5 + "px");
                    tooltip.style("top", e.y - 200 - 5 + "px");
                    tooltip.style("width", 200);
                    tooltip.style("height", 200);

                    const y0 = d3.scaleLinear(d3.extent(data.dailyData, d => d.value), [30,130]);
                    const x0 = d3.scaleLinear([0,168],[30,198]);
                    const line = d3.line()
                        .x(d => x0(d.hour))
                        .y(d => y0(d.value));
                    const svg0 = d3.create("svg");
                    /////////
                    svg0.append("g")
                        .attr("transform", `translate(0,130)`)
                        .call(d3.axisBottom(x0).ticks(10));

                    svg0.append("g")
                        .attr("transform", `translate(30,0)`)
                        .call(d3.axisLeft(y0).ticks(5))
                        .call(g => g.select(".domain").remove())
                        .call(g => g.selectAll(".tick line").clone()
                            .attr("x2", 140)
                            .attr("stroke-opacity", 0.1))
                        .call(g => g.append("text")
                            .attr("x", -30)
                            .attr("y", 10)
                            .attr("fill", "currentColor")
                            .attr("text-anchor", "start")
                            .text("↑ " + measure));
                    ////////
                    svg0.append("path")
                        .attr("fill", "none")
                        .attr("stroke", "blue")
                        .attr("stroke-width", 1)
                        .attr("d", line(data.dailyData));
                    tooltip.html(`Week beginning ${data.start.toDateString()}<br>`);
                    a = svg0.node();
                    document.getElementById("tooltip").append(a);
                })
                .on("mouseout", function(_e) {
                    tooltip.style("opacity", 0);
                    tooltip.html("");
                    tooltip.style("left", "0px");
                    tooltip.style("top", "0px");
                });


            detail.innerHTML = "Hover over the graph to reveal hourly data per week!<br>";
            detail.append(svg.node());
        }




        loadindicator.innerHTML = "All done!";
        setTimeout(function() {loadindicator.style.display = "none";}, 3000);
        updateSnapshotBox(null);
    });