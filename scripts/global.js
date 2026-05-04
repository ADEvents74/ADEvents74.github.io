var addonData = {
  ice: { price: 1.5, type: "per-guest" },
  dry: { price: 1.75, type: "per-guest" },
  soft: { price: 1.5, type: "per-guest" },
  premium: { price: 2.5, type: "per-guest" },
  tip: { price: 100, type: "per-bartender" },
};

var addonState = {
  ice: false,
  dry: false,
  soft: false,
  premium: false,
  tip: false,
};

var BASE_LAT = 26.2975429;
var BASE_LNG = -81.8060104;
var travelMiles = 0;
var travelFee = 0;

var map,
  eventMarker,
  baseMarker,
  radiusRings = [],
  polyline;

var MI_TO_M = 1609.344;

var eventIcon = L.icon({
  iconUrl: '/assets/icons/custom/location.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

function initMap() {
  map = L.map("event-map", { zoomControl: true }).setView(
    [BASE_LAT, BASE_LNG],
    11,
  );

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution: "© OpenStreetMap © CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    },
  ).addTo(map);

  var baseIcon = L.icon({
    iconUrl: '/assets/icons/custom/location.svg',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -36],
  });

  baseMarker = L.marker([BASE_LAT, BASE_LNG], {
    icon: baseIcon,
    zIndexOffset: 1000,
  })
    .addTo(map)
    .bindPopup("<b>Naples Mobile Bar</b><br>13585 Tamiami Trl N, Naples FL", {
      closeButton: false,
    });

  drawRings();

  map.on("click", function (e) {
    placeEventPin(e.latlng.lat, e.latlng.lng, null);
  });
}

function drawRings() {
  [20, 30].forEach(function (mi, i) {
    var color = i === 0 ? "#7b2d42" : "#a84d6a";
    var ring = L.circle([BASE_LAT, BASE_LNG], {
      radius: mi * MI_TO_M,
      color: color,
      weight: 1.5,
      fill: false,
      dashArray: "6 4",
      className: "range-ring",
    }).addTo(map);
    radiusRings.push(ring);

    L.marker([BASE_LAT + mi / 69.05, BASE_LNG], {
      icon: L.divIcon({
        className: "",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html:
          '<div style="margin-left: -50px; width: 100px; text-align: center;">' +
          '<span style="font-size:14px; font-weight:600; color:' +
          color +
          "; background:" +
          color +
          '40; padding:1px 10px; border-radius:50px; white-space:nowrap; display: inline-block; transform: translateY(-50%);">' +
          mi +
          " miles" +
          "</span>" +
          "</div>",
      }),
      interactive: false,
    }).addTo(map);
  });
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  var R = 3958.8;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLng = ((lng2 - lng1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function travelFeeForMiles(mi) {
  var miles = Math.round(mi);
  if (miles <= 20) return 0;
  if (miles <= 30) return (miles * 1.0) - 20;
  return (miles * 1.5) - 30;
}

function placeEventPin(lat, lng, label) {
  if (eventMarker) map.removeLayer(eventMarker);
  if (polyline) map.removeLayer(polyline);

  eventMarker = L.marker([lat, lng], { icon: eventIcon, draggable: true })
    .addTo(map)
    .bindPopup(label || "Your event venue", { closeButton: false })
    .openPopup();

  eventMarker.on("dragend", function (e) {
    var ll = e.target.getLatLng();
    reverseGeocode(ll.lat, ll.lng);
    updateTravel(ll.lat, ll.lng, null);
  });

  polyline = L.polyline(
    [
      [BASE_LAT, BASE_LNG],
      [lat, lng],
    ],
    {
      color: "#a84d6a",
      weight: 2,
      dashArray: "6 5",
      opacity: 0.6,
    },
  ).addTo(map);

  updateTravel(lat, lng, label);
  map.fitBounds(
    [
      [BASE_LAT, BASE_LNG],
      [lat, lng],
    ],
    { padding: [40, 40], maxZoom: 13 },
  );
}

function updateTravel(lat, lng, label) {
  travelMiles = haversineMiles(BASE_LAT, BASE_LNG, lat, lng);
  travelFee = travelFeeForMiles(travelMiles);

  var badge = document.getElementById("travel-badge");
  var placeEl = document.getElementById("travel-place");
  var distEl = document.getElementById("travel-dist-label");
  var feeEl = document.getElementById("travel-fee-label");

  badge.classList.remove("hidden");
  placeEl.textContent =
    label || "Lat " + lat.toFixed(4) + ", Lng " + lng.toFixed(4);
  distEl.textContent = travelMiles.toFixed(1) + " miles from base";
  feeEl.textContent = travelFee === 0 ? "Free" : fmt(travelFee);

  calculate();
}

function clearLocation() {
  if (eventMarker) {
    map.removeLayer(eventMarker);
    eventMarker = null;
  }
  if (polyline) {
    map.removeLayer(polyline);
    polyline = null;
  }
  document.getElementById("addr-input").value = "";
  document.getElementById("travel-badge").classList.add("hidden");
  var resultsList = document.getElementById("autocomplete-results");
  if (resultsList) resultsList.classList.add("hidden");
  travelMiles = 0;
  travelFee = 0;
  map.setView([BASE_LAT, BASE_LNG], 11);
  calculate();
}

function searchAddress() {
  var query = document.getElementById("addr-input").value.trim();
  if (!query) return;
  var url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&viewbox=-82.7,27.5,-80.5,25.5&q=" +
    encodeURIComponent(query);
  fetch(url, { headers: { "Accept-Language": "en" } })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (!data.length) return;
      var r = data[0];
      document.getElementById("addr-input").value = r.display_name
        .split(",")
        .slice(0, 3)
        .join(",");
      placeEventPin(
        parseFloat(r.lat),
        parseFloat(r.lon),
        r.display_name.split(",").slice(0, 2).join(","),
      );
    });
}

function reverseGeocode(lat, lng) {
  var url =
    "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
    lat +
    "&lon=" +
    lng;
  fetch(url, { headers: { "Accept-Language": "en" } })
    .then(function (r) {
      return r.json();
    })
    .then(function (data) {
      if (data && data.display_name) {
        var short = data.display_name.split(",").slice(0, 3).join(",");
        document.getElementById("addr-input").value = short;
        document.getElementById("travel-place").textContent = data.display_name
          .split(",")
          .slice(0, 2)
          .join(",");
      }
    });
}

function toggle(id) {
  addonState[id] = !addonState[id];
  var card = document.getElementById("card-" + id);
  var tick = card.querySelector(".addon-tick");
  var icon = card.querySelector(".addon-tick-icon");

  if (addonState[id]) {
    card.classList.add("active", "!border-green", "shadow-[0_6px_28px_rgba(26,122,74,0.2)]");
    card.querySelector(".addon-price").classList.add("!text-green", "!font-medium");
    tick.classList.add("bg-green");
    icon.classList.replace("opacity-0", "opacity-100");
    icon.classList.replace("scale-0", "scale-100");
  } else {
    card.classList.remove("active", "!border-green", "shadow-[0_6px_28px_rgba(26,122,74,0.2)]");
    card.querySelector(".addon-price").classList.remove("!text-green", "!font-medium");
    tick.classList.remove("bg-green");
    icon.classList.replace("opacity-100", "opacity-0");
    icon.classList.replace("scale-100", "scale-0");
  }
  calculate();
}

function nudge(id, delta) {
  var el = document.getElementById(id);
  var min = parseInt(el.min) || 1;
  el.value = Math.max(min, (parseInt(el.value) || min) + delta);
  calculate();
}

function fmt(n) {
  return (
    "$" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtBig(n) {
  var parts = n.toFixed(2).split(".");
  var d = parseInt(parts[0]).toLocaleString("en-US");
  return (
    `$${d}<span class="text-[22px] sm:text-[26px] align-super font-bold">.${parts[1]}</span>`
  )
}

function calculate() {
  var guests = Math.max(
    1,
    parseInt(document.getElementById("guests").value) || 1,
  );
  var hours = Math.max(
    4,
    parseInt(document.getElementById("hours").value) || 4,
  );
  var bartenders = Math.max(1, Math.ceil(guests / 75));
  var base = bartenders * 220;
  var extraHrs = hours > 4 ? (hours - 4) * 60 * bartenders : 0;
  var addons = 0;
  for (var id in addonData) {
    if (!addonState[id]) continue;
    var a = addonData[id];
    addons += a.type === "per-guest" ? a.price * guests : a.price * bartenders;
  }
  document.getElementById("disp-base").textContent = fmt(base);
  document.getElementById("row-extra").style.display =
    extraHrs > 0 ? "flex" : "none";
  document.getElementById("disp-extra").textContent = "+" + fmt(extraHrs);
  document.getElementById("row-addons").style.display =
    addons > 0 ? "flex" : "none";
  document.getElementById("disp-addons").textContent = fmt(addons);
  document.getElementById("row-travel").style.display =
    travelFee > 0 ? "flex" : "none";
  document.getElementById("disp-travel").textContent = fmt(travelFee);
  document.getElementById("disp-bartenders").textContent =
    bartenders +
    " bartender" +
    (bartenders > 1 ? "s" : "") +
    " ・ " +
    hours +
    " hours";
  var totalEl = document.getElementById("total-number");
  totalEl.style.opacity = "0.2";
  setTimeout(function () {
    totalEl.innerHTML = fmtBig(base + extraHrs + addons + travelFee);
    totalEl.style.opacity = "1";
  }, 140);
}

document.addEventListener("DOMContentLoaded", function () {
  var searchInput = document.getElementById("addr-input");
  var resultsList = document.getElementById("autocomplete-results");
  var autocompleteTimeout, controller;

  searchInput.addEventListener("input", function (e) {
    clearTimeout(autocompleteTimeout);
    if (controller) controller.abort();
    var query = e.target.value.trim();

    if (query.length < 2) {
      if (resultsList) resultsList.classList.add("hidden");
      return;
    }

    autocompleteTimeout = setTimeout(function () {
      controller = new AbortController();
      if (resultsList) {
        resultsList.innerHTML =
          '<li class="px-4 py-2.5 text-sm text-white/50 italic">Searching...</li>';
        resultsList.classList.remove("hidden");
      }

      var url =
        "https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=us&addressdetails=1&viewbox=-82.7,27.5,-80.5,25.5&q=" +
        encodeURIComponent(query);

      fetch(url, {
        signal: controller.signal,
        headers: { "Accept-Language": "en" },
      })
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          if (!resultsList) return;
          resultsList.innerHTML = "";
          if (data && data.length > 0) {
            data.forEach(function (r) {
              var display = r.display_name.split(",").slice(0, 4).join(",");
              var li = document.createElement("li");
              li.className =
                "px-4 py-2.5 text-sm text-white hover:bg-green-mid cursor-pointer border-b border-black/[0.04] last:border-0 transition-colors";
              li.textContent = display;
              li.onclick = function () {
                searchInput.value = r.display_name
                  .split(",")
                  .slice(0, 3)
                  .join(",");
                resultsList.classList.add("hidden");
                placeEventPin(
                  parseFloat(r.lat),
                  parseFloat(r.lon),
                  r.display_name.split(",").slice(0, 2).join(","),
                );
              };
              resultsList.appendChild(li);
            });
          } else {
            resultsList.innerHTML =
              '<li class="px-4 py-2.5 text-sm text-gray-400">No results found</li>';
          }
        })
        .catch(function (err) {
          if (err.name === "AbortError") return;
          if (resultsList) resultsList.classList.add("hidden");
        });
    }, 150);
  });

  document.addEventListener("click", function (e) {
    if (
      resultsList &&
      !searchInput.contains(e.target) &&
      !resultsList.contains(e.target)
    )
      resultsList.classList.add("hidden");
  });

  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      clearTimeout(autocompleteTimeout);
      if (controller) controller.abort();
      searchAddress();
      if (resultsList) resultsList.classList.add("hidden");
    }
  });

  document.getElementById("guests").addEventListener("input", calculate);
  document.getElementById("hours").addEventListener("input", calculate);
  initMap();
  calculate();
});
