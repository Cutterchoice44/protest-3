// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

// Show a “not found” message in the wrapper
function showNotFound() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `
    <p style="color:white;text-align:center;margin:2rem;">
      Profile not found.
    </p>`;
}

// Show a generic error message in the wrapper
function showError() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `
    <p style="color:white;text-align:center;margin:2rem;">
      Error loading profile.
    </p>`;
}

// Create a Google Calendar link from UTC datetimes
function createGoogleCalLink(title, startUtc, endUtc) {
  if (!startUtc || !endUtc) return "#";
  const fmt = dt =>
    new Date(dt).toISOString().replace(/-|:|\.\d{3}/g, '');
  return `https://www.google.com/calendar/render?action=TEMPLATE`
       + `&text=${encodeURIComponent(title)}`
       + `&dates=${fmt(startUtc)}/${fmt(endUtc)}`;
}

async function initPage() {
  const params   = new URLSearchParams(window.location.search);
  const artistId = params.get("id");
  if (!artistId) return showNotFound();

  try {
    // 1) Fetch the artist record
    const res = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${artistId}`,
      { headers: { "x-api-key": API_KEY } }
    );
    if (!res.ok) {
      if (res.status === 404) return showNotFound();
      throw new Error(`Artist API returned ${res.status}`);
    }
    let payload = await res.json();

    // 2) Unwrap common wrappers
    let artist = payload.artist || payload.data || payload;
    if (artist.attributes) artist = { ...artist, ...artist.attributes };

    // 3) Only proceed if they’re tagged “website”
    const tags = Array.isArray(artist.tags)
      ? artist.tags.map(t => String(t).toLowerCase())
      : [];
    if (!tags.includes("website")) {
      return showNotFound();
    }

    // 4) Populate Name
    document.getElementById("dj-name").textContent = artist.name || "";

    // 5) Render Bio/Description (TipTap JSON or plain/string)
    const bioEl = document.getElementById("dj-bio");
    let raw = null;
    for (const key of ["description", "descriptionHtml", "bio", "bioHtml"]) {
      if (artist[key] != null) {
        raw = artist[key];
        break;
      }
    }
    let bioHtml = "";
    if (raw) {
      // TipTap JSON?
      if (typeof raw === "object" && Array.isArray(raw.content)) {
        const extractText = node => {
          if (node.text) return node.text;
          if (node.content) return node.content.map(extractText).join("");
          return "";
        };
        bioHtml = raw.content
          .map(block => `<p>${extractText(block)}</p>`)
          .join("");
      }
      // String: HTML or plain text
      else if (typeof raw === "string") {
        if (/<[a-z][\s\S]*>/i.test(raw)) {
          bioHtml = raw; // already HTML
        } else {
          bioHtml = raw
            .split(/\r?\n+/)
            .map(p => `<p>${p}</p>`)
            .join("");
        }
      }
    }
    bioEl.innerHTML = bioHtml || `<p>No bio available.</p>`;

    // 6) Artwork
    const artEl = document.getElementById("dj-artwork");
    artEl.src = artist.logo?.["512x512"]
             || artist.logo?.default
             || artist.avatar
             || FALLBACK_ART;
    artEl.alt = artist.name || "";

    // 7) Social links
    const sl = document.getElementById("social-links");
    sl.innerHTML = "";
    for (const [plat, url] of Object.entries(artist.socials || {})) {
      if (!url) continue;
      const label = plat
        .replace(/Handle$/,'')
        .replace(/([A-Z])/g,' $1')
        .trim();
      const li = document.createElement("li");
      li.innerHTML = `<a href="${url}" target="_blank" rel="noopener">
        ${label.charAt(0).toUpperCase() + label.slice(1)}
      </a>`;
      sl.appendChild(li);
    }

    // 8) “Add to Calendar” button logic
    const btn = document.getElementById("calendar-btn");
    // disable by default
    btn.disabled = true;
    btn.onclick = null;

    try {
      const now     = new Date().toISOString();
      const oneYear = new Date(Date.now() + 365*24*60*60*1000).toISOString();
      const schedRes = await fetch(
        `${BASE_URL}/station/${STATION_ID}/artists/${artistId}/schedule`
        + `?startDate=${now}&endDate=${oneYear}`,
        { headers: { "x-api-key": API_KEY } }
      );
      if (!schedRes.ok) throw new Error(`Schedule API ${schedRes.status}`);
      const { schedules = [] } = await schedRes.json();

      if (schedules.length) {
        const { startDateUtc, endDateUtc } = schedules[0];
        btn.disabled = false;
        btn.onclick = () => {
          window.open(
            createGoogleCalLink(
              `DJ ${artist.name} Live Set`,
              startDateUtc,
              endDateUtc
            ),
            "_blank"
          );
        };
      }
    } catch (err) {
      console.error("Schedule fetch error:", err);
      // leave button disabled
    }

    // 9) Mixcloud archives (localStorage)
    const storageKey = `${artistId}-mixcloud-urls`;
    function loadShows() {
      const list = document.getElementById("mixes-list");
      list.innerHTML = "";
      (JSON.parse(localStorage.getItem(storageKey))||[]).forEach(url => {
        const div = document.createElement("div");
        div.className = "mix-show";
        div.innerHTML = `
          <iframe
            src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${encodeURIComponent(url)}"
            allow="autoplay"
          ></iframe>
          <button data-url="${url}">Remove show</button>
        `;
        div.querySelector("button").onclick = () => {
          const arr = JSON.parse(localStorage.getItem(storageKey))||[];
          localStorage.setItem(
            storageKey,
            JSON.stringify(arr.filter(u => u !== url))
          );
          loadShows();
        };
        list.appendChild(div);
      });
    }
    loadShows();
    document.getElementById("add-show-btn").onclick = () => {
      const pwd = prompt("Enter password to add a show:");
      if (pwd !== MIXCLOUD_PW) return alert("Incorrect password");
      const input = document.getElementById("mixcloud-url-input");
      const url   = input.value.trim();
      if (!url) return;
      const arr = JSON.parse(localStorage.getItem(storageKey))||[];
      arr.push(url);
      localStorage.setItem(storageKey, JSON.stringify(arr));
      input.value = "";
      loadShows();
    };

  } catch (err) {
    console.error("Error loading profile:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
