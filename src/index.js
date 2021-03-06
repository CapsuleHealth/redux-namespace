import React, { Component, PropTypes } from 'react';
import * as ReactRedux from 'react-redux';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import result from 'lodash/result';

export const BIND = 'BIND_NAMESPACE';

export const shape = {
  assign: PropTypes.func.isRequired,
  dispatch: PropTypes.func.isRequired,
  select: PropTypes.func.isRequired
}

export function assign(namespace, key, value) {
  if (! key)
    return (key, value) =>
      assign(namespace, key, value);

  let action = (value) => ({
    type: BIND, payload: { namespace, key, value } })

  if ([...arguments].length < assign.length)
    return action;

  return action(value);
}

export function connect(namespace, initial={}) {
  return (WrappedComponent) =>
    ReactRedux.connect(
      ({ namespace: { [namespace]: state } }) => ({
        assign: assign(namespace),
        select(key, __) {
          return arguments.length > 0 ? result(state, key, __) : state || {}
        }
      })
    )(class NamespaceBridge extends Component {
      render () {
        let {assign, dispatch, select, ...props} = this.props;

        function dispatcher(target, value) {
          return (
            // curry or assign many
            arguments.length === 1 ?
            // curry assign with target
              isString(target) ?
                dispatcher.bind(this, target)
            // map target ({key: value}) => assign
            : ( Object.keys(target).map((key) =>
                  dispatcher(key, target[key]))
              , target )
          // deferred selector
          : isFunction(value) ?
            (...args) => dispatcher(target, value(...args))
          // memoize
          : select(target) !== value ?
              ( dispatch(assign(target, value))
              , value )
          : value
          )
        }

        props = {
          // namespace defers to props
          ...select(),
          ...props,
          assign: dispatcher,
          assigns(key, selector) {
            return dispatcher(key, (value, ...args) =>
                isString(selector) ? result(value, selector)
              : isFunction(selector) ? selector(value, ...args)
              : value
            )
          },
          dispatch,
          select,
          selects() {
            return select.bind(null, ...arguments);
          },
          touched(key) {
            return select(['@@touched'].concat(key), false);
          }
        }

        return React.isValidElement(WrappedComponent) ?
          React.cloneElement(WrappedComponent, props)
        : React.createElement(WrappedComponent, props)
      }
    })
}

export function reducer (state={}, action={}) {
  if (action.type === BIND) {
    let { payload: { namespace, key, value } } = action

    let ns = result(state, namespace, {});
    let touched = result(ns, '@@touched', {});

    ns = {
      ...ns, [key]: value, ['@@touched']: { ...touched, [key]: true } };

    state = { ...state, [namespace]: ns };
  }

  return state;
}
