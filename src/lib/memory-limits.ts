/*
 * How many photos one memory may carry, agreed between the browser and the
 * server so the two can never disagree about it.
 *
 * 30, up from 10. The ceiling is not the document — thirty photo records is a
 * few kilobytes against a 16 MB limit — nor the grid, which asks Cloudinary for
 * 400px crops. It is the upload: thirty files leaving a phone at once is thirty
 * requests competing for one uplink, each finishing slower than the last and
 * none of them showing honest progress. So the count goes up and the number in
 * flight is capped instead.
 */
export const MAX_PHOTOS_PER_MEMORY = 30;

/**
 * How many uploads may be in the air at once.
 *
 * Three, not all of them. A browser opens about six connections per host
 * anyway, so a larger number only queues inside the browser where nothing can
 * report on it; three keeps every running upload's progress bar moving, which
 * is the difference between "it is working" and "it is stuck". The rest wait
 * their turn and start the moment a slot frees.
 */
export const UPLOAD_CONCURRENCY = 3;

/** A per-photo note is a caption, not an essay — it sits under one picture. */
export const MAX_PHOTO_CAPTION = 300;
