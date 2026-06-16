import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

/**
 * Universal wrapper for fetching a collection from Firestore.
 * Supports filtering and sorting.
 */
export const getCollection = async (collectionName, conditions = [], sort = null) => {
  try {
    let q = collection(db, collectionName);
    
    if (conditions.length > 0) {
      conditions.forEach((c) => {
        q = query(q, where(c.field, c.op, c.value));
      });
    }
    
    if (sort) {
      q = query(q, orderBy(sort.field, sort.direction || 'asc'));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching collection ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Get a single document by ID
 */
export const getDocument = async (collectionName, id) => {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
  } catch (error) {
    console.error(`Error fetching doc ${collectionName}/${id}:`, error);
    throw error;
  }
};

/**
 * Create a new document in a collection
 */
export const createDocument = async (collectionName, data) => {
  try {
    const docData = { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, collectionName), docData);
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Create or overwrite a document with a specific ID
 */
export const setDocument = async (collectionName, id, data) => {
  const { setDoc } = await import('firebase/firestore');
  try {
    const docRef = doc(db, collectionName, id);
    const docData = { ...data, updatedAt: serverTimestamp() };
    await setDoc(docRef, docData, { merge: true });
    return { id, ...docData };
  } catch (error) {
    console.error(`Error setting document ${collectionName}/${id}:`, error);
    throw error;
  }
};

/**
 * Update an existing document
 */
export const updateDocument = async (collectionName, id, data) => {
  try {
    const docRef = doc(db, collectionName, id);
    const updateData = { ...data, updatedAt: serverTimestamp() };
    await updateDoc(docRef, updateData);
    return { id, ...data }; // Note: serverTimestamp won't be fully resolved here immediately
  } catch (error) {
    console.error(`Error updating document ${collectionName}/${id}:`, error);
    throw error;
  }
};

/**
 * Delete a document
 */
export const deleteDocument = async (collectionName, id) => {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
    return id;
  } catch (error) {
    console.error(`Error deleting document ${collectionName}/${id}:`, error);
    throw error;
  }
};
