import { stringify } from 'qs';
import merge from 'deepmerge';
import axios from 'axios';
import {
  GET_LIST,
  GET_ONE,
  CREATE,
  UPDATE,
  DELETE,
  GET_MANY,
  GET_MANY_REFERENCE,
} from './actions';

import defaultSettings from './default-settings';
import { NotImplementedError } from './errors';
import init from './initializer';

// Set HTTP interceptors.
init();

/**
 * Maps react-admin queries to a JSONAPI REST API
 *
 * @param {string} apiUrl the base URL for the JSONAPI
 * @param {string} userSettings Settings to configure this client.
 *
 * @param {string} type Request type, e.g GET_LIST
 * @param {string} resource Resource name, e.g. "posts"
 * @param {Object} payload Request parameters. Depends on the request type
 * @returns {Promise} the Promise for a data response
 */
export default (apiUrl, userSettings = {}) => (type, resource, params) => {
  let url = '';
  const settings = merge(defaultSettings, userSettings);

  const options = {
    headers: settings.headers,
  };

  switch (type) {
    case GET_LIST: {
      const { page, perPage } = params.pagination;

      // Create query with pagination params.
      const query = {
        'page[number]': page,
        'page[size]': perPage,
      };

      // Add all filter params to query.
      Object.keys(params.filter || {}).forEach((key) => {
        query[`filter[${key}]`] = params.filter[key];
      });

      // Add sort parameter
      if (params.sort && params.sort.field) {
        const prefix = params.sort.order === 'ASC' ? '' : '-';
        query.sort = `${prefix}${params.sort.field}`;
      }

      url = `${apiUrl}/${resource}?${stringify(query)}`;
      break;
    }

    case GET_ONE:
      url = `${apiUrl}/${resource}/${params.id}`;
      break;

    case CREATE:
      url = `${apiUrl}/${resource}`;
      options.method = 'POST';
      options.data = JSON.stringify({
        data: { type: resource, attributes: params.data },
      });
      break;

    case UPDATE: {
      console.log(params);
      url = `${apiUrl}/${resource}/${params.id}`;
      let data = {
        data: {
          id: params.id.toString(),
          type: resource,
          attributes: params.data,
        },
      };
      delete data.data.attributes.id;
      options.method = settings.updateMethod;
      options.data = JSON.stringify(data);
      break;
    }

    case DELETE:
      url = `${apiUrl}/${resource}/${params.id}`;
      options.method = 'DELETE';
      break;

    case GET_MANY: {
      const query = {
        filter: {
          id: []
        }
      };

      // Add all filter params to query.
      Object.keys(params.ids || {}).forEach((key) => {
        query.filter['id'][key] = params.ids[key];
      });

      url = `${apiUrl}/${resource}?${stringify(query)}`;
      break;
    }

    case GET_MANY_REFERENCE: {
      const { page, perPage } = params.pagination;

      // Create query with pagination params.
      const query = {
        'page[number]': page,
        'page[size]': perPage,
      };

      // Add all filter params to query.
      Object.keys(params.filter || {}).forEach((key) => {
        query[`filter[${key}]`] = params.filter[key];
      });

      // Add the reference id to the filter params.
      query[`filter[${params.target}]`] = params.id;
      
      url = `${apiUrl}/${resource}?${stringify(query)}`;
      break;
    }

    default:
      throw new NotImplementedError(`Unsupported Data Provider request type ${type}`);
  }

  return axios({ url, ...options })
    .then((response) => {
      switch (type) {
        case GET_MANY:
        case GET_LIST: {
          return {
            data: response.data.data.map(value => Object.assign(
              { id: parseInt(value.id) },
              value.attributes,
            )),
            total: response.data.meta != undefined && response.data.meta.page != undefined ? response.data.meta.page.total : response.data.count,
          };
        }

        case GET_MANY_REFERENCE: {
          return {
            data: response.data.data.map(value => Object.assign(
              { id: parseInt(value.id) },
              value.attributes,
            )),
            total: response.data.meta != undefined && response.data.meta.page != undefined ? response.data.meta.page.total : response.data.count,
          };
        }

        case GET_ONE: {
          response.data.data.id = parseInt(response.data.data.id);
          const { id, attributes } = response.data.data;

          return {
            data: {
              id, ...attributes,
            },
          };
        }

        case CREATE: {
          const { id, attributes } = response.data.data;

          return {
            data: {
              id, ...attributes,
            },
          };
        }

        case UPDATE: {
          response.data.data.id = parseInt(response.data.data.id);
          const { id, attributes } = response.data.data;
          return {
            data: {
              id, ...attributes,
            },
          };
        }

        case DELETE: {

          return {
            data: { id: params.id },
          };
        }

        default:
          throw new NotImplementedError(`Unsupported Data Provider request type ${type}`);
      }
    });
};
