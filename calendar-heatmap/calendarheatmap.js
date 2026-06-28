/* OptiRise Calendar Heatmap — Looker Studio Community Visualization
   One cell per day, colored by status_score:
     1  = Accepted  → Rise blue   #3d3db4
     0  = Pending   → Amber       #b86b00
    -1  = No data   → Light grey  #e8eaed
   Ignored clusters (status_score = -1 with activity) shown in red #a02030
*/

(function() {

  var dscc = require('@google/dscc');
  var d3 = require('d3');

  // ── Helper: parse date string YYYYMMDD → Date ──
  function parseDate(str) {
    if (!str) return null;
    var s = String(str);
    if (s.length === 8) {
      return new Date(
        parseInt(s.slice(0,4)),
        parseInt(s.slice(4,6)) - 1,
        parseInt(s.slice(6,8))
      );
    }
    return new Date(str);
  }

  // ── Helper: get Monday of the week containing d ──
  function getMonday(d) {
    var day = d.getDay() || 7;
    var result = new Date(d);
    if (day !== 1) result.setDate(d.getDate() - (day - 1));
    return result;
  }

  // ── Helper: add days ──
  function addDays(date, n) {
    var d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  // ── Helper: format date YYYY-MM-DD ──
  function fmt(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth()+1).padStart(2,'0') + '-' +
      String(d.getDate()).padStart(2,'0');
  }

  // ── Main draw function ──
  function draw(message) {
    // Clear previous render
    var container = document.getElementById('container') || document.body;
    container.innerHTML = '';

    // ── Style variables ──
    var style = message.style || {};
    var COLOR_ACCEPTED = (style.colorAccepted && style.colorAccepted.value) || '#3d3db4';
    var COLOR_IGNORED  = (style.colorIgnored  && style.colorIgnored.value)  || '#a02030';
    var COLOR_PENDING  = (style.colorPending  && style.colorPending.value)  || '#b86b00';
    var COLOR_NODATA   = (style.colorNoData   && style.colorNoData.value)   || '#e8eaed';

    // ── Parse data ──
    var rows = message.tables.DEFAULT;
    var dataMap = {};
    rows.forEach(function(row) {
      var dateVal = row.dimension[0];
      var score   = parseFloat(row.metric[0]);
      var d = parseDate(dateVal);
      if (d) dataMap[fmt(d)] = score;
    });

    // ── Date range ──
    var dates = Object.keys(dataMap).sort();
    if (dates.length === 0) {
      container.innerHTML = '<p style="font-family:Google Sans,sans-serif;color:#9aa0a6;padding:16px;font-size:12px;">No data available</p>';
      return;
    }

    var minDate = new Date(dates[0]);
    var maxDate = new Date(dates[dates.length - 1]);
    var startMonday = getMonday(minDate);

    // ── Layout ──
    var CELL   = 18;
    var GAP    = 3;
    var STEP   = CELL + GAP;
    var LEFT   = 28;  // space for month labels
    var TOP    = 22;  // space for day labels
    var LEGEND = 28;  // bottom legend space

    // Count weeks
    var totalDays = Math.round((maxDate - startMonday) / 86400000) + 7;
    var totalWeeks = Math.ceil(totalDays / 7);

    var svgW = LEFT + totalWeeks * STEP + 10;
    var svgH = TOP + 7 * STEP + LEGEND;

    // ── SVG ──
    var svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', '0 0 ' + svgW + ' ' + svgH)
      .style('font-family', 'Google Sans, Arial, sans-serif');

    // ── Day labels (Mon→Sun) ──
    var dayLabels = ['Mon','','Wed','','Fri','','Sun'];
    dayLabels.forEach(function(lbl, i) {
      if (!lbl) return;
      svg.append('text')
        .attr('x', LEFT - 4)
        .attr('y', TOP + i * STEP + CELL * 0.75)
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('fill', '#9aa0a6')
        .text(lbl);
    });

    // ── Month labels ──
    var lastMonth = -1;
    for (var w = 0; w < totalWeeks; w++) {
      var weekStart = addDays(startMonday, w * 7);
      var m = weekStart.getMonth();
      if (m !== lastMonth) {
        var monthNames = ['Jan','Feb','Mar','Apr','May','Jun',
                          'Jul','Aug','Sep','Oct','Nov','Dec'];
        svg.append('text')
          .attr('x', LEFT + w * STEP)
          .attr('y', TOP - 6)
          .attr('font-size', '9px')
          .attr('fill', '#5f6368')
          .text(monthNames[m]);
        lastMonth = m;
      }
    }

    // ── Cells ──
    var tooltip = d3.select(container)
      .append('div')
      .style('position', 'absolute')
      .style('background', '#202124')
      .style('color', '#fff')
      .style('padding', '4px 8px')
      .style('border-radius', '4px')
      .style('font-size', '11px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', 999);

    for (var w = 0; w < totalWeeks; w++) {
      for (var d = 0; d < 7; d++) {
        var cellDate = addDays(startMonday, w * 7 + d);
        if (cellDate > addDays(maxDate, 1)) continue;

        var dateStr = fmt(cellDate);
        var score = dataMap.hasOwnProperty(dateStr) ? dataMap[dateStr] : null;

        var color;
        var label;
        if (score === null || score === -1) {
          color = COLOR_NODATA;
          label = 'No data';
        } else if (score === 1) {
          color = COLOR_ACCEPTED;
          label = 'Reviewed';
        } else if (score === 0) {
          color = COLOR_PENDING;
          label = 'Pending';
        } else {
          color = COLOR_IGNORED;
          label = 'Ignored';
        }

        var x = LEFT + w * STEP;
        var y = TOP + d * STEP;

        svg.append('rect')
          .attr('x', x)
          .attr('y', y)
          .attr('width', CELL)
          .attr('height', CELL)
          .attr('rx', 3)
          .attr('ry', 3)
          .attr('fill', color)
          .style('cursor', 'pointer')
          .on('mouseover', (function(ds, lbl) {
            return function(event) {
              tooltip
                .style('opacity', 1)
                .html('<strong>' + ds + '</strong><br>' + lbl);
            };
          })(dateStr, label))
          .on('mousemove', function(event) {
            tooltip
              .style('left', (event.offsetX + 10) + 'px')
              .style('top',  (event.offsetY - 28) + 'px');
          })
          .on('mouseout', function() {
            tooltip.style('opacity', 0);
          });
      }
    }

    // ── Legend ──
    var legendY = TOP + 7 * STEP + 10;
    var legendItems = [
      { color: COLOR_ACCEPTED, label: 'Reviewed' },
      { color: COLOR_PENDING,  label: 'Pending'  },
      { color: COLOR_NODATA,   label: 'No data'  },
    ];
    var lx = LEFT;
    legendItems.forEach(function(item) {
      svg.append('rect')
        .attr('x', lx).attr('y', legendY)
        .attr('width', 10).attr('height', 10)
        .attr('rx', 2).attr('fill', item.color);
      svg.append('text')
        .attr('x', lx + 13).attr('y', legendY + 9)
        .attr('font-size', '9px').attr('fill', '#5f6368')
        .text(item.label);
      lx += 80;
    });
  }

  // ── Subscribe ──
  dscc.subscribeToData(draw, { transform: dscc.objectTransform });

})();
