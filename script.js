// script_IND_DJ.js
const API_KEY      = "pk_0b8abc6f834b444f949f727e88a728e0";
const BASE_URL     = "https://api.radiocult.fm/api";
const STATION_ID   = "cutters-choice-radio";
const MIXCLOUD_PW  = "cutters44";
const FALLBACK_ART = "https://i.imgur.com/qWOfxOS.png";

function showNotFound() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `<p style="color:white;text-align:center;margin:2rem;">
    Profile not found.
  </p>`;
}
function showError() {
  const w = document.querySelector('.profile-wrapper');
  if (w) w.innerHTML = `<p style="color:white;text-align:center;margin:2rem;">
    Error loading profile.
  </p>`;
}
function createGoogleCalLink(title, s, e) {
  if (!s||!e) return "#";
  const fmt = dt=>new Date(dt).toISOString().replace(/-|:|\.\d{3}/g,'');
  return `https://www.google.com/calendar/render?action=TEMPLATE`
       + `&text=${encodeURIComponent(title)}`
       + `&dates=${fmt(s)}/${fmt(e)}`;
}

async function initPage() {
  console.clear();
  const params = new URLSearchParams(location.search);
  const id     = params.get("id");
  if (!id) return showNotFound();

  try {
    const r = await fetch(
      `${BASE_URL}/station/${STATION_ID}/artists/${id}`,
      { headers:{ "x-api-key": API_KEY } }
    );
    if (!r.ok) {
      if (r.status===404) return showNotFound();
      throw new Error(`Artist API ${r.status}`);
    }

    const payload = await r.json();
    console.log("▶️ raw payload:", payload);

    // unwrap data/artist plus any .attributes wrapper
    let artist = payload.artist || payload.data || payload;
    if (artist.attributes) {
      artist = { ...artist, ...artist.attributes };
    }
    console.log("🏷️ final artist:", artist);

    // only website-tagged DJs
    const tags = Array.isArray(artist.tags)
      ? artist.tags.map(t=>String(t).toLowerCase())
      : [];
    if (!tags.includes("website")) {
      console.warn("no WEBSITE tag:", artist.tags);
      return showNotFound();
    }

    // name
    document.getElementById("dj-name").textContent = artist.name || "";

    // —— description ——
    const bioEl = document.getElementById("dj-bio");
    let rawDesc = null, descHtml = "";

    // try your console-inspected field first
    for (const key of [
      "description",
      "descriptionHtml",
      "bio",
      "bioHtml",
      "about",
      "aboutHtml"
    ]) {
      if (artist[key] != null) {
        rawDesc = artist[key];
        console.log(`✔️ using ${key}`, rawDesc);
        break;
      }
    }

    if (rawDesc) {
      // TipTap JSON?
      if (typeof rawDesc==="object" && Array.isArray(rawDesc.content)) {
        descHtml = rawDesc.content
          .filter(n=>n.type==="paragraph")
          .map(p=>`<p>`+ (p.content||[]).map(t=>t.text||"").join("") + `</p>`)
          .join("");
      }
      // string: HTML or plain
      else if (typeof rawDesc==="string") {
        if (/<[a-z][\s\S]*>/i.test(rawDesc)) {
          descHtml = rawDesc;
        } else {
          descHtml = rawDesc
            .split(/\r?\n+/)
            .map(p=>`<p>${p}</p>`)
            .join("");
        }
      }
    }
    bioEl.innerHTML = descHtml || `<p>No bio available.</p>`;

    // …continue populating artwork, socials, schedule, mixes exactly as before…

  } catch(err) {
    console.error("❌ load error:", err);
    showError();
  }
}

window.addEventListener("DOMContentLoaded", initPage);
