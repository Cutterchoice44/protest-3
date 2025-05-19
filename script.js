// script.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt => new Date(dt)
    .toISOString()
    .replace(/-|:|\.\d{3}/g, '');
  return `https://www.google.com/calendar/render?action=TEMPLATE`
       + `&text=${encodeURIComponent(title)}`
       + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`;
}

async function initPage() {
  // Force “andy-social” in CodePen if no query string arrives
  const params = new URLSearchParams(location.search);
  const djSlug = params.get("dj") || "andy-social";

  try {
    let res, artist;

    // 1) Try the path-based endpoint (often works better in local/CodePen)
    res = await fetch(`${BASE_URL}/artists/${encodeURIComponent(djSlug)}?apiKey=${API_KEY}`);
    if (res.ok) {
      artist = await res.json();
    } else {
      console.warn("Path lookup failed:", res.status);
      // 2) Fallback to query-param endpoint
      res = await fetch(`${BASE_URL}/artists?slug=${encodeURIComponent(djSlug)}&apiKey=${API_KEY}`);
      if (!res.ok) throw new Error("Slug lookup failed: " + res.status);
      const arr = await res.json();
      if (!Array.isArray(arr) || !arr.length) throw new Error("No artist found");
      artist = arr[0];
    }

    // Only show if tagged WEBSITE
    if (!artist.tags?.includes("WEBSITE")) {
      document.body.innerHTML = `
        <p style="color:white; text-align:center; margin-top:2rem;">
          Profile not available.
        </p>`;
      return;
    }

    // Populate Name & Bio
    document.getElementById("dj-name").textContent = artist.name;
    document.getElementById("dj-bio").innerHTML = `<p>${artist.bio || ""}</p>`;

    // Artwork
    document.getElementById("dj-artwork").src = artist.avatar || FALLBACK_ART;

    // Social links
    const sl = document.getElementById("social-links");
    sl.innerHTML = "";
    for (const [plat, url] of Object.entries(artist.socialLinks || {})) {
      if (!url) continue;
      const li = document.createElement("li");
      li.innerHTML = `<a href="${url}" target="_blank">
                        ${plat.charAt(0).toUpperCase() + plat.slice(1)}
                      </a>`;
      sl.appendChild(li);
    }

    // Next show → Google Calendar link
    const schRes = await fetch(
      `${BASE_URL}/schedules?station=${STATION_ID}`
      + `&artist=${artist.id}&limit=1&apiKey=${API_KEY}`
    );
    const sched = await schRes.json();
    if (sched.length) {
      document.getElementById("calendar-btn").href =
        createGoogleCalLink(
          `DJ ${artist.name} Live Set`,
          sched[0].startUtc,
          sched[0].endUtc
        );
    } else {
      document.getElementById("calendar-btn").style.display = "none";
    }

    // Mixcloud archive section
    const key = `${djSlug}-mixcloud-urls`;
    function loadShows() {
      const m = document.getElementById("mixes-list");
      m.innerHTML = "";
      (JSON.parse(localStorage.getItem(key)) || []).forEach(url => {
        const div = document.createElement("div");
        div.className = "mix-show";
        div.innerHTML = `
          <iframe 
            src="https://www.mixcloud.com/widget/iframe/
                  ?hide_cover=1&light=1&feed=${encodeURIComponent(url)}"
            allow="autoplay"></iframe>
          <button data-url="${url}">Remove show</button>
        `;
        div.querySelector("button").onclick = () => {
          const arr2 = JSON.parse(localStorage.getItem(key)) || [];
          localStorage.setItem(key, JSON.stringify(arr2.filter(u => u !== url)));
          loadShows();
        };
        m.appendChild(div);
      });
    }
    loadShows();
    document.getElementById("add-show-btn").onclick = () => {
      const pwd = prompt("Enter password to add a show:");
      if (pwd !== MIXCLOUD_PW) return alert("Incorrect password");
      const url = document.getElementById("mixcloud-url-input").value.trim();
      if (!url) return;
      const arr2 = JSON.parse(localStorage.getItem(key)) || [];
      arr2.push(url);
      localStorage.setItem(key, JSON.stringify(arr2));
      loadShows();
      document.getElementById("mixcloud-url-input").value = "";
    };

  } catch (err) {
    console.error("DJ load error:", err);
    document.body.innerHTML = `
      <p style="color:white; text-align:center; margin-top:2rem;">
        Error loading profile.
      </p>`;
  }
}

window.addEventListener("DOMContentLoaded", initPage);
