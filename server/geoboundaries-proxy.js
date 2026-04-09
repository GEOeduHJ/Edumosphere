#!/usr/bin/env node
/*
  Small express proxy to fetch GeoBoundaries GeoJSON server-side
  Usage: node server/geoboundaries-proxy.js
  Listens on PORT env or 5174 by default.
*/
const express = require('express')
const { URL } = require('url')

const PORT = process.env.GEO_PROXY_PORT ? Number(process.env.GEO_PROXY_PORT) : 5174
const app = express()

app.get('/api/geoboundaries/proxy/:iso/:level', async (req, res) => {
  try {
    const iso = String(req.params.iso).toUpperCase()
    const level = String(req.params.level).toUpperCase()
    const release = 'gbOpen'
    const metaUrl = `https://www.geoboundaries.org/api/current/${release}/${iso}/${level}/`

    const metaResp = await fetch(metaUrl)
    if (!metaResp.ok) {
      console.error('meta fetch failed', metaResp.status, metaResp.statusText, metaUrl)
      return res.status(502).send('meta fetch failed')
    }
    const metaJson = await metaResp.json()
    const meta = Array.isArray(metaJson) ? metaJson[0] : metaJson
    if (!meta) return res.status(404).send('no metadata')

    // prefer simplifiedGeometryGeoJSON when available
    const fileUrl = meta.simplifiedGeometryGeoJSON || meta.gjDownloadURL || meta.gjdwnld
    if (!fileUrl) return res.status(404).send('no geojson url')

    // Fetch the geojson and follow redirects server-side
    const fileResp = await fetch(fileUrl, { redirect: 'follow' })
    if (!fileResp.ok) {
      console.error('file fetch failed', fileResp.status, fileResp.statusText, fileUrl)
      return res.status(502).send('file fetch failed')
    }

    const arr = await fileResp.arrayBuffer()
    const buf = Buffer.from(arr)
    const ct = fileResp.headers.get('content-type') || 'application/json'
    res.set('Content-Type', ct)
    res.set('Cache-Control', 'public, max-age=86400')
    res.send(buf)
  } catch (err) {
    console.error('proxy error', err && err.stack ? err.stack : err)
    res.status(500).send('proxy error')
  }
})

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`geoBoundaries proxy listening on http://localhost:${PORT}`)
})
