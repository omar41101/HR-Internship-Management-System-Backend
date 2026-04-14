import AppError from "../utils/AppError.js";
import { errors } from "../utils/errors.js";

// A helper function to help build the query for filtering, sorting, searching and pagination
const buildQuery = (Model, queryParams) => {
  // Get all documents 
  let query = Model.find();

  // -------- Filtering -------- //
  /* 
    Take a copy of the query parameters (for ex: ?status=active) and 
    remove the fields that are meant for pagination, sorting and searching 
  */
  const queryObj = { ...queryParams };
  const excludedFields = ["page", "limit", "sort", "keyword"];
  excludedFields.forEach((el) => delete queryObj[el]);

  // Filter
  query = query.find(queryObj);

  // -------- Search -------- //
  if (queryParams.keyword) {
    query = query.find({
      $or: [
        { name: { $regex: queryParams.keyword, $options: "i" } },
        { title: { $regex: queryParams.keyword, $options: "i" } }
      ]
    });
  }

  // -------- Sorting: Support multiple sorting parameters -------- //
  if (queryParams.sort) {
    const sortBy = queryParams.sort.split(",").join(" "); // Example: "sort=createdAt,-name" => "createdAt -name"
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  return query;
};

// Creation of a new document
export const createOne = (Model) => async (data) => {
  const doc = await Model.create(data);

  return {
    status: "Success",
    code: 201,
    data: doc
  };
};

// Get a single document by Id
export const getOne = (Model, populateOptions = null) => async (id) => {
  let query = Model.findById(id);

  if (populateOptions) {
    query = query.populate(populateOptions);
  }

  const doc = await query;

  if (!doc) {
    throw new AppError(
        errors.NOT_FOUND.message,
        errors.NOT_FOUND.code,
        errors.NOT_FOUND.errorCode
    );
  }

  return {
    status: "Success",
    code: 200,
    data: doc
  };
};


// Get all documents with optional filtering, sorting, searching and pagination
export const getAll = (Model) => async (queryParams) => {
  let query = buildQuery(Model, queryParams);

  // Pagination
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const totalCount = await Model.countDocuments();

  query = query.skip(skip).limit(limit);

  const docs = await query;

  return {
    status: "Success",
    code: 200,
    data: docs,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      limitPerPage: limit,
      totalCount
    }
  };
};

// Update a document
export const updateOne = (Model) => async (id, data) => {
  const doc = await Model.findByIdAndUpdate(id, data, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!doc) {
    throw new AppError(
      errors.NOT_FOUND.message,
      errors.NOT_FOUND.code,
      errors.NOT_FOUND.errorCode
    );
  }

  return {
    status: "Success",
    code: 200,
    data: doc
  };
};

// Delete a document
export const deleteOne = (Model) => async (id) => {
  const doc = await Model.findByIdAndDelete(id);

  if (!doc) {
    throw new AppError(
      errors.NOT_FOUND.message,
      errors.NOT_FOUND.code,
      errors.NOT_FOUND.errorCode
    );
  }

  return {
    status: "Success",
    code: 200,
    data: null
  };
};
