var addonData = {
    frontbar: { price: 65, type: "per-unit" },
    backbar: { price: 55, type: "per-unit" },
    cooler: { price: 50, type: "per-unit" },
    ice: { price: 1.5, type: "per-guest" },
    dry: { price: 1.75, type: "per-guest" },
    soft: { price: 1.5, type: "per-guest" },
    premium: { price: 2.5, type: "per-guest" },
    tip: { price: 100, type: "per-bartender" }
};

var addonState = {
    ice: false,
    dry: false,
    soft: false,
    premium: false,
    tip: false,
    frontbar: 0,
    backbar: 0,
    cooler: 0
};

const usa = document.getElementById("usa");
const colombia = document.getElementById("colombia");
var country = "usa";
var translating = false;
var USD_TO_COP = 3800;
var MI_TO_KM = 1.609344;

async function fetchExchangeRate() {
    try {
        const res = await fetch("https://api.frankfurter.dev/v2/rate/USD/COP");
        const data = await res.json();
        if (data?.rate) {
            USD_TO_COP = data.rate;
            calculate();
        }
    } catch (err) {
        console.warn("Exchange rate fetch failed, using fallback:", USD_TO_COP);
    }
}

fetchExchangeRate();

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
    iconUrl: "/assets/icons/custom/location.svg",
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
        iconUrl: "/assets/icons/custom/location.svg",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -36],
    });

    baseMarker = L.marker([BASE_LAT, BASE_LNG], {
        icon: baseIcon,
        zIndexOffset: 1000,
    })
        .addTo(map)
        .bindPopup(
            "<b>Naples Mobile Bar</b><br>13585 Tamiami Trl N, Naples FL",
            {
                closeButton: false,
            },
        );

    drawRings();

    map.on("click", function (e) {
        placeEventPin(e.latlng.lat, e.latlng.lng, null);
    });
}

function drawRings() {
    if (!map) return;

    radiusRings.forEach((r) => map.removeLayer(r));
    radiusRings = [];

    const isUSA = country === "usa";
    const rings = isUSA ? [20, 30] : [32, 48];

    rings.forEach(function (val, i) {
        var color = i === 0 ? "#7b2d42" : "#a84d6a";
        var radiusM = isUSA ? val * MI_TO_M : val * 1000;
        var label = isUSA ? `${val} miles` : `${val} km`;

        var ring = L.circle([BASE_LAT, BASE_LNG], {
            radius: radiusM,
            color: color,
            weight: 1.5,
            fill: false,
            dashArray: "6 4",
            className: "range-ring",
        }).addTo(map);
        radiusRings.push(ring);

        var latOffset = isUSA ? val / 69.05 : val / 111.32;
        var labelMarker = L.marker([BASE_LAT + latOffset, BASE_LNG], {
            icon: L.divIcon({
                className: "",
                iconSize: [0, 0],
                iconAnchor: [0, 0],
                html: `<div style="margin-left:-50px;width:100px;text-align:center;">
          <span style="font-size:14px;font-weight:600;color:${color};background:${color}40;padding:1px 10px;border-radius:50px;white-space:nowrap;display:inline-block;transform:translateY(-50%);">
            ${label}
          </span></div>`,
            }),
            interactive: false,
        }).addTo(map);
        radiusRings.push(labelMarker);
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
    if (miles <= 30) return miles * 1.0 - 20;
    return miles * 1.5 - 30;
}

function placeEventPin(lat, lng, label) {
    if (eventMarker) map.removeLayer(eventMarker);
    if (polyline) map.removeLayer(polyline);

    eventMarker = L.marker([lat, lng], { icon: eventIcon, draggable: true })
        .addTo(map)
        .bindPopup(label || (country === "usa" ? "Your event venue" : "Tu lugar de evento"), { closeButton: false })
        .openPopup();
    eventMarker._isFallbackLabel = !label;

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
    distEl.textContent =
        country === "usa"
            ? `${travelMiles.toFixed(1)} miles from base`
            : `${(travelMiles * MI_TO_KM).toFixed(1)} km de la base`;
    feeEl.textContent = travelFee === 0 ? (country === "usa" ? "Included" : "Incluida") : fmt(travelFee);

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
                document.getElementById("travel-place").textContent =
                    data.display_name.split(",").slice(0, 2).join(",");
            }
        });
}

function toggle(id) {
    addonState[id] = !addonState[id];
    var card = document.getElementById("card-" + id);
    var tick = card.querySelector(".addon-tick");
    var icon = card.querySelector(".addon-tick-icon");

    if (addonState[id]) {
        card.classList.add(
            "active",
            "!border-wine",
            "shadow-[0_6px_28px_rgba(26,122,74,0.2)]",
        );
        card.querySelector(".addon-price").classList.add(
            "!text-wine",
            "!font-medium",
        );
        tick.classList.add("bg-wine");
        icon.classList.replace("opacity-0", "opacity-100");
        icon.classList.replace("scale-0", "scale-100");
    } else {
        card.classList.remove(
            "active",
            "!border-wine",
            "shadow-[0_6px_28px_rgba(26,122,74,0.2)]",
        );
        card.querySelector(".addon-price").classList.remove(
            "!text-wine",
            "!font-medium",
        );
        tick.classList.remove("bg-wine");
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

function setQty(id, delta) {
    addonState[id] = Math.max(0, (addonState[id] || 0) + delta);
    document.getElementById("qty-" + id).textContent = addonState[id];

    var card = document.getElementById("card-" + id);
    var price = card.querySelector(".addon-price");

    if (addonState[id] > 0) {
        card.classList.add("active", "!border-wine", "shadow-[0_6px_28px_rgba(26,122,74,0.2)]");
        price.classList.add("!text-wine", "!font-medium");
    } else {
        card.classList.remove("active", "!border-wine", "shadow-[0_6px_28px_rgba(26,122,74,0.2)]");
        price.classList.remove("!text-wine", "!font-medium");
    }
    calculate();
}

function fmt(n) {
    return country === "usa"
        ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `$${Math.round(n * USD_TO_COP).toLocaleString("es-CO")} COP`;
}

function fmtBig(n) {
    if (country === "colombia") {
        var cop = Math.round(n * USD_TO_COP).toLocaleString("es-CO");
        return `$${cop}<span class="text-[22px] sm:text-[26px] align-super font-bold">COP</span>`;
    }

    var parts = n.toFixed(2).split(".");
    var d = parseInt(parts[0]).toLocaleString("en-US");
    return `$${d}<span class="text-[22px] sm:text-[26px] align-super font-bold">.${parts[1]}</span>`;
}

function dropChange(el, property, value) {
    el.classList.add("!transition-opacity");
    el.classList.add("!duration-125");
    el.classList.add("!ease-in");
    let original = Number(
        window.getComputedStyle(el).getPropertyValue("opacity"),
    );
    el.style.opacity = String(clamp(original - 0.5, 0.1, 1));
    setTimeout(() => {
        el.style.opacity = String(original);
        el[property] = value;

        setTimeout(() => {
          el.classList.remove("!transition-opacity");
          el.classList.remove("!duration-125");
          el.classList.remove("!ease-in");
        }, 125);
    }, 250);
}

function calculate(isTranslation) {
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
    var rentals = 0;
    var addons = 0;
    for (var id in addonData) {
        if (!addonState[id]) continue;
        var a = addonData[id];
        var amount = a.type === "per-guest" ? a.price * guests
                : a.type === "per-bartender" ? a.price * bartenders
                : a.price * addonState[id];
        if (a.type === "per-unit") rentals += amount;
        else addons += amount;
    }

    document.getElementById("row-rentals").style.display = rentals > 0 ? "flex" : "none";
    document.getElementById("row-addons").style.display = addons > 0 ? "flex" : "none";
    document.getElementById("row-extra").style.display = extraHrs > 0 ? "flex" : "none";
    document.getElementById("row-addons").style.display = addons > 0 ? "flex" : "none";
    document.getElementById("row-travel").style.display = travelFee > 0 ? "flex" : "none";
    
    var totalEl = document.getElementById("total-number");
    var total = fmtBig(base + extraHrs + rentals + addons + travelFee);
    if (isTranslation === true) {
      dropChange(document.getElementById("disp-base"), "textContent", fmt(base));
      dropChange(document.getElementById("disp-extra"), "textContent", "+" + fmt(extraHrs));
      dropChange(document.getElementById("disp-rentals"), "textContent", fmt(rentals));
        dropChange(document.getElementById("disp-addons"), "textContent", fmt(addons));
      dropChange(document.getElementById("disp-travel"), "textContent", fmt(travelFee));
      dropChange(document.getElementById("disp-bartenders"), "textContent", `${bartenders} bartender${bartenders > 1 ? "s" : ""} ・ ${hours} ${country === "usa" ? "hours" : "horas"}`);
      dropChange(totalEl, "innerHTML", total);
    } else {
      document.getElementById("disp-base").textContent = fmt(base);
      document.getElementById("disp-extra").textContent = "+" + fmt(extraHrs);
      document.getElementById("disp-rentals").textContent = fmt(rentals);
      document.getElementById("disp-addons").textContent = fmt(addons);
      document.getElementById("disp-travel").textContent = fmt(travelFee);
      document.getElementById("disp-bartenders").textContent = `${bartenders} bartender${bartenders > 1 ? "s" : ""} ・ ${hours} ${country === "usa" ? "hours" : "horas"}`;
      totalEl.innerHTML = total;
    }
}

function clamp(n, min, max) {
    if (n > max) return max;
    if (n < min) return min;
    return n;
}

function updateCountry(snap, to) {
    if (translating || (to && (country === to))) return;
    translating = true;

    country = to || country;
    const button = document.getElementById(country);
    const other = document.getElementById(
        country === "usa" ? "colombia" : "usa",
    );
    const language = country === "usa" ? "en" : "es";

    button.classList.remove("scale-90");
    button.classList.remove("opacity-25");
    other.classList.add("scale-90");
    other.classList.add("opacity-25");

    document
        .querySelectorAll(`[data-${language}], [data-translatable]`)
        .forEach((el) => {
            let translated = (el.dataset[language] || "")
                .replace(/\{convert:([\d.]+)\}/g, (_, n) => fmt(parseFloat(n)));

            if (snap) {
                if (el.id === "addr-input") {
                    el.placeholder = translated || el.placeholder;
                } else {
                    el.innerText = translated || el.innerText;
                }
            } else {
                dropChange(
                    el,
                    el.id === "addr-input" ? "placeholder" : "innerText",
                    translated,
                );
            }
        });

    if (snap) {
        translating = false;
        document.getElementById("travel-dist-label").textContent = country === "usa" ? `${travelMiles.toFixed(1)} miles from base` : `${(travelMiles * MI_TO_KM).toFixed(1)} km de la base`;
        document.getElementById("travel-fee-label").textContent = travelFee === 0 ? (country === "usa" ? "Included" : "Incluida") : fmt(travelFee);
    } else {
        dropChange(document.getElementById("travel-dist-label"), "textContent", country === "usa" ? `${travelMiles.toFixed(1)} miles from base` : `${(travelMiles * MI_TO_KM).toFixed(1)} km de la base`);
        dropChange(document.getElementById("travel-fee-label"), "textContent", travelFee === 0 ? (country === "usa" ? "Included" : "Incluida") : fmt(travelFee));
        setTimeout(() => {
            translating = false;
        }, 500);
    }
    document.title = country === "usa" ? "Event Price Calculator" : "Cotizador de eventos";
    if (eventMarker?._isFallbackLabel) {
        eventMarker.setPopupContent(
            country === "usa" ? "Your event venue" : "Tu lugar de evento"
        );
    }

    drawRings();
    calculate(true);
}

updateCountry(true);

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
                            var display = r.display_name
                                .split(",")
                                .slice(0, 4)
                                .join(",");
                            var li = document.createElement("li");
                            li.className =
                                "px-4 py-2.5 text-sm text-white hover:bg-wine-mid cursor-pointer border-b border-black/[0.04] last:border-0 transition-colors";
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
                                    r.display_name
                                        .split(",")
                                        .slice(0, 2)
                                        .join(","),
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

    usa.addEventListener("click", () => {
        updateCountry(false, "usa");
    });

    colombia.addEventListener("click", () => {
        updateCountry(false, "colombia");
    });
});
