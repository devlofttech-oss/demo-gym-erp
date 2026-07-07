import {
  getCollection,
  getDocument,
  createDocument,
  setDocument,
  updateDocument,
  deleteDocument,
} from './db';

const path = (gymId, collName) => `gyms/${gymId}/${collName}`;

export const getTenantCollection = (gymId, collName, conditions, sort) => {
  if (!gymId) return Promise.resolve([]);
  return getCollection(path(gymId, collName), conditions, sort);
};

export const getTenantDocument = (gymId, collName, id) => {
  if (!gymId) return Promise.resolve(null);
  return getDocument(path(gymId, collName), id);
};

export const createTenantDocument = (gymId, collName, data) => {
  if (!gymId) return Promise.reject(new Error('No gym context'));
  return createDocument(path(gymId, collName), data);
};

export const setTenantDocument = (gymId, collName, id, data) => {
  if (!gymId) return Promise.reject(new Error('No gym context'));
  return setDocument(path(gymId, collName), id, data);
};

export const updateTenantDocument = (gymId, collName, id, data) => {
  if (!gymId) return Promise.reject(new Error('No gym context'));
  return updateDocument(path(gymId, collName), id, data);
};

export const deleteTenantDocument = (gymId, collName, id) => {
  if (!gymId) return Promise.reject(new Error('No gym context'));
  return deleteDocument(path(gymId, collName), id);
};
