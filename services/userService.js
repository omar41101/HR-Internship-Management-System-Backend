import User from "../models/User.js";
import {
  getOne,
  getAll,
  createOne,
  updateOne,
  deleteOne
} from "./handlersFactory.js";

export const getUser = getOne(User);
export const getUsers = getAll(User);
export const createUser = createOne(User);
export const updateUser = updateOne(User);
export const deleteUser = deleteOne(User);
