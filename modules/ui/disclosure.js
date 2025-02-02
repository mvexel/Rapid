import { dispatch as d3_dispatch } from 'd3-dispatch';

import { localizer } from '../core/localizer';
import { prefs } from '../core/preferences';
import { svgIcon } from '../svg/icon';
import { utilFunctor } from '../util';
import { utilRebind } from '../util/rebind';
import { uiToggle } from './toggle';


export function uiDisclosure(context, key, expandedDefault) {
  const dispatch = d3_dispatch('toggled');
  let _expanded;
  let _label = utilFunctor('');
  let _updatePreference = true;
  let _content = function () {};


  let disclosure = function(selection) {
    if (_expanded === undefined || _expanded === null) {
      // loading _expanded here allows it to be reset by calling `disclosure.expanded(null)`
      const preference = prefs(`disclosure.${key}.expanded`);
      _expanded = preference === null ? !!expandedDefault : (preference === 'true');
    }

    let hideToggle = selection.selectAll(`.hide-toggle-${key}`)
      .data([0]);

    // enter
    let hideToggleEnter = hideToggle.enter()
      .append('a')
      .attr('href', '#')
      .attr('class', `hide-toggle hide-toggle-${key}`)
      .call(svgIcon('', 'pre-text', 'hide-toggle-icon'));

    hideToggleEnter
      .append('span')
      .attr('class', 'hide-toggle-text');

    // update
    hideToggle = hideToggleEnter
      .merge(hideToggle);

    hideToggle
      .on('click', toggle)
      .classed('expanded', _expanded);

    hideToggle.selectAll('.hide-toggle-text')
      .html(_label());

    hideToggle.selectAll('.hide-toggle-icon')
      .attr('xlink:href', _expanded ? '#rapid-icon-down'
        : (localizer.textDirection() === 'rtl') ? '#rapid-icon-backward' : '#rapid-icon-forward'
      );


    let wrap = selection.selectAll('.disclosure-wrap')
      .data([0]);

    // enter/update
    wrap = wrap.enter()
      .append('div')
      .attr('class', `disclosure-wrap disclosure-wrap-${key}`)
      .merge(wrap)
      .classed('hide', !_expanded);

    if (_expanded) {
      wrap
        .call(_content);
    }


    function toggle(d3_event) {
      d3_event.preventDefault();
      _expanded = !_expanded;

      if (_updatePreference) {
        prefs(`disclosure.${key}.expanded`, _expanded);
      }

      hideToggle
        .classed('expanded', _expanded);

      hideToggle.selectAll('.hide-toggle-icon')
        .attr('xlink:href', _expanded ? '#rapid-icon-down'
          : (localizer.textDirection() === 'rtl') ? '#rapid-icon-backward' : '#rapid-icon-forward'
        );

      wrap
        .call(uiToggle(_expanded));

      if (_expanded) {
        wrap
          .call(_content);
      }

      dispatch.call('toggled', this, _expanded);
    }
  };


  disclosure.label = (val) => {
    if (!arguments.length) return _label;
    _label = utilFunctor(val);
    return disclosure;
  };


  disclosure.expanded = (val) => {
    if (!arguments.length) return _expanded;
    _expanded = val;
    return disclosure;
  };


  disclosure.updatePreference = (val) => {
    if (!arguments.length) return _updatePreference;
    _updatePreference = val;
    return disclosure;
  };


  disclosure.content = (val) => {
    if (!arguments.length) return _content;
    _content = val;
    return disclosure;
  };


  return utilRebind(disclosure, dispatch, 'on');
}
