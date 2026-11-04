/* Standalone, dependency-free comparison chart. Load with <script defer>. */
(() => {
  'use strict';

  const scriptURL = document.currentScript ? document.currentScript.src : document.baseURI;
  const dataURL = new URL('assets/comparison-data.json', scriptURL);
  const NS = 'http://www.w3.org/2000/svg';
  const COLORS = {background: '#0a0f15', plot: '#0e161e', text: '#edf1f7', muted: '#b1bccb', grid: '#293541', axis: '#718195'};

  function svgElement(name, attributes = {}, text) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // Null values, and explicitly absent source steps, start a new subpath.
  function meanPath(points, missingSteps, sx, sy) {
    let path = '', previousStep = null;
    const missing = missingSteps || [];
    for (const [step, value] of points) {
      if (value === null || !Number.isFinite(value) || !Number.isFinite(step)) {
        previousStep = null;
        continue;
      }
      const gap = previousStep !== null && missing.some(item => item > previousStep && item < step);
      path += `${previousStep === null || gap ? 'M' : 'L'}${sx(step)},${sy(value)} `;
      previousStep = step;
    }
    return path.trim();
  }

  function bandPath(points, sx, sy) {
    let path = '', open = false;
    for (const [step, value] of points) {
      if (value === null || !Number.isFinite(value) || !Number.isFinite(step)) {
        if (open) path += 'Z ';
        open = false;
        continue;
      }
      path += `${open ? 'L' : 'M'}${sx(step)},${sy(value)} `;
      open = true;
    }
    return `${path}${open ? 'Z' : ''}`.trim();
  }

  function tickText(value) {
    return Number(value.toFixed(2)).toString();
  }

  async function initialize() {
    const host = document.getElementById('agent-chart');
    const select = document.getElementById('task-select');
    const legend = document.getElementById('agent-chart-legend');
    const caption = document.getElementById('agent-chart-caption');
    if (!host || !select || !legend || !caption) return;

    host.setAttribute('aria-busy', 'true');
    host.textContent = 'Loading comparison…';
    caption.setAttribute('aria-live', 'polite');
    select.setAttribute('aria-controls', 'agent-chart');
    select.disabled = true;

    try {
      const response = await fetch(dataURL);
      if (!response.ok) throw new Error(`Chart data unavailable (${response.status}).`);
      const data = await response.json();
      const views = [data.aggregate, ...data.panels];
      const agents = new Map(data.agents.map(agent => [agent.name, agent]));
      const options = document.createDocumentFragment();
      for (const view of views) {
        const option = document.createElement('option');
        option.value = view.key;
        option.textContent = view.key === 'all' ? 'All six tasks — equal-weight mean' : view.title;
        options.append(option);
      }
      select.replaceChildren(options);
      select.value = 'all';
      select.disabled = false;

      const bandLabel = document.createElement('label');
      bandLabel.className = 'comparison-band-control';
      bandLabel.style.cssText = 'display:inline-flex;align-items:center;gap:.45em;margin-left:1em;color:inherit;font:inherit;';
      const bandInput = document.createElement('input');
      bandInput.type = 'checkbox';
      bandInput.checked = true;
      bandInput.id = 'comparison-show-sd';
      bandInput.setAttribute('aria-controls', 'agent-chart');
      const bandWords = document.createElement('span');
      bandWords.textContent = 'Show ±1 SD';
      bandLabel.append(bandInput, bandWords);
      const controls = select.closest('.comparison-controls') || select.parentElement;
      controls.append(bandLabel);

      legend.setAttribute('role', 'list');
      legend.setAttribute('aria-label', 'Agent line colors and styles');
      legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:.75rem 1.5rem;color:#edf1f7;font:inherit;';
      legend.replaceChildren();
      for (const agent of data.agents) {
        const item = document.createElement('span');
        item.setAttribute('role', 'listitem');
        item.style.cssText = 'display:inline-flex;align-items:center;gap:.55rem;white-space:nowrap;';
        const swatch = svgElement('svg', {viewBox:'0 0 48 12', width:48, height:12, 'aria-hidden':'true'});
        swatch.style.flex = '0 0 48px';
        swatch.append(svgElement('line', {x1:2, y1:6, x2:46, y2:6, stroke:agent.color,
          'stroke-width':agent.name.startsWith('MolRSI') ? 3.4 : 2.4,
          'stroke-linecap':'round', 'stroke-dasharray':agent.dash.length ? agent.dash.join(' ') : 'none'}));
        const name = document.createElement('span');
        name.textContent = agent.name;
        item.append(swatch, name);
        if (agent.dash.length) item.setAttribute('aria-label', `${agent.name}, dashed line`);
        legend.append(item);
      }

      function render() {
        const view = views.find(item => item.key === select.value) || data.aggregate;
        const isAggregate = view.key === 'all';
        const showBands = !isAggregate && bandInput.checked;
        // Author styles never override this hidden state.
        bandLabel.style.display = isAggregate ? 'none' : 'inline-flex';
        bandInput.disabled = isAggregate;
        const description = isAggregate
          ? 'Equal-weight mean across all six antibacterial tasks. A value appears only where all six tasks have a reported point; missing values remain blank. Source: Fig. 2d.'
          : `${view.title}: mean test AUPRC across five data splits.${showBands ? ' Shading shows ±1 SD.' : ''} Missing source points remain blank. Source: Fig. 2d.`;
        caption.textContent = description;

        const width = host.getBoundingClientRect().width || 1000;
        // Keep labels readable when the fixed viewBox is scaled to a phone.
        const compact = width < 560;
        const fontSize = Math.max(18, Math.min(48, 12800 / width));
        const axisFont = Math.max(20, Math.min(48, 12800 / width));
        const left = compact ? Math.max(112, fontSize * 3 + 8) : 112;
        const plot = {x:left, y:compact ? 78 : 28, width:970-left, height:(compact ? 350 : 400)-fontSize};
        const sx = value => plot.x + (value-view.xRange[0])/(view.xRange[1]-view.xRange[0])*plot.width;
        const sy = value => plot.y + plot.height - (value-view.yRange[0])/(view.yRange[1]-view.yRange[0])*plot.height;

        const svg = svgElement('svg', {viewBox:'0 0 1000 520', role:'img',
          'aria-labelledby':'agent-chart-title agent-chart-description', preserveAspectRatio:'xMidYMid meet'});
        svg.style.cssText = 'display:block;width:100%;height:auto;max-width:100%;font-family:inherit;';
        svg.append(svgElement('title', {id:'agent-chart-title'}, isAggregate ? 'Agent comparison: mean across all six tasks' : `Agent comparison: ${view.title}`));
        svg.append(svgElement('desc', {id:'agent-chart-description'}, `${description} Six methods: ${data.agents.map(agent=>agent.name).join(', ')}. Claude Code uses a dashed line.`));
        svg.append(svgElement('rect', {width:1000, height:520, fill:COLORS.background}));
        const defs = svgElement('defs');
        const clip = svgElement('clipPath', {id:'agent-chart-plot-clip'});
        clip.append(svgElement('rect', {x:plot.x,y:plot.y,width:plot.width,height:plot.height}));
        defs.append(clip); svg.append(defs);
        svg.append(svgElement('rect', {x:plot.x,y:plot.y,width:plot.width,height:plot.height,fill:COLORS.plot}));

        for (const value of view.yTicks) {
          const y = sy(value);
          svg.append(svgElement('line', {x1:plot.x,y1:y,x2:plot.x+plot.width,y2:y,stroke:COLORS.grid,'stroke-width':1,'vector-effect':'non-scaling-stroke'}));
          svg.append(svgElement('text', {x:plot.x-18,y,fill:COLORS.muted,'font-size':fontSize,'text-anchor':'end','dominant-baseline':'middle'},tickText(value)));
        }
        for (const value of view.xTicks) {
          const x = sx(value);
          svg.append(svgElement('line', {x1:x,y1:plot.y+plot.height,x2:x,y2:plot.y+plot.height+7,stroke:COLORS.axis,'stroke-width':1,'vector-effect':'non-scaling-stroke'}));
          svg.append(svgElement('text', {x,y:plot.y+plot.height+fontSize+12,fill:COLORS.muted,'font-size':fontSize,'text-anchor':'middle'},tickText(value)));
        }

        const series = [...view.series].sort((a,b)=>Number(a.name.startsWith('MolRSI'))-Number(b.name.startsWith('MolRSI')));
        const plotGroup = svgElement('g', {'clip-path':'url(#agent-chart-plot-clip)'});
        if (showBands) {
          for (const item of series) {
            if (!item.bandPoints || !item.bandPoints.length) continue;
            plotGroup.append(svgElement('path', {d:bandPath(item.bandPoints,sx,sy),fill:agents.get(item.name).color,
              'fill-opacity':item.name.startsWith('MolRSI') ? .17 : .055,stroke:'none','data-agent':item.name,'data-kind':'sd-band'}));
          }
        }
        for (const item of series) {
          const agent = agents.get(item.name);
          const path = svgElement('path', {d:meanPath(item.dataPoints,item.missingSteps,sx,sy),fill:'none',stroke:agent.color,
            'stroke-width':item.name.startsWith('MolRSI') ? 3.4 : 1.9,'stroke-linejoin':'round','stroke-linecap':'round',
            'stroke-dasharray':agent.dash.length ? agent.dash.join(' ') : 'none','vector-effect':'non-scaling-stroke',
            'data-agent':item.name,'data-kind':'mean'});
          path.append(svgElement('title', {}, agent.name));
          plotGroup.append(path);
        }
        svg.append(plotGroup);
        svg.append(svgElement('path', {d:`M${plot.x},${plot.y}V${plot.y+plot.height}H${plot.x+plot.width}`,fill:'none',stroke:COLORS.axis,'stroke-width':1.2,'vector-effect':'non-scaling-stroke'}));
        svg.append(svgElement('text', {x:plot.x+plot.width/2,y:503,fill:COLORS.muted,'font-size':axisFont,'text-anchor':'middle'},'Workflow evaluations'));
        svg.append(svgElement('text', compact
          ? {x:plot.x+plot.width/2,y:48,fill:COLORS.muted,'font-size':axisFont,'text-anchor':'middle'}
          : {transform:`translate(28 ${plot.y+plot.height/2}) rotate(-90)`,fill:COLORS.muted,'font-size':axisFont,'text-anchor':'middle'},'Mean test AUPRC'));
        host.replaceChildren(svg);
        host.removeAttribute('aria-busy');
      }

      select.addEventListener('change',render);
      bandInput.addEventListener('change',render);
      render();
      let frame = 0;
      const onResize = () => {cancelAnimationFrame(frame);frame=requestAnimationFrame(render);};
      if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(host);
      else window.addEventListener('resize',onResize,{passive:true});
    } catch (error) {
      host.removeAttribute('aria-busy');
      host.textContent = 'The comparison chart could not be loaded. Please refresh the page to try again.';
      caption.textContent = 'Source: Fig. 2d.';
      console.error('MolRSI comparison chart:',error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
