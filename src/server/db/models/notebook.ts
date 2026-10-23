import { Schema, model, models, type InferSchemaType } from "mongoose";

/*
 * Sub-documents carry no _id: cells are addressed by (date, slot), days by
 * date, slots and sections by key — the same way the router's arrayFilters
 * find them, so two people ticking two different cells never overwrite each
 * other.
 */
const slotSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
  },
  { _id: false },
);

const cellSchema = new Schema(
  {
    slot: { type: String, required: true },
    text: { type: String, default: "" },
    done: { type: Boolean, default: false },
  },
  { _id: false },
);

const daySchema = new Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD (Saigon day key)
    label: { type: String, default: "" }, // "tập C", "cầu lông"
    cells: { type: [cellSchema], default: [] },
  },
  { _id: false },
);

const sectionSchema = new Schema(
  {
    key: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
  },
  { _id: false },
);

const pointSchema = new Schema(
  {
    date: { type: String, required: true },
    value: { type: Number, required: true },
  },
  { _id: false },
);

/**
 * Sổ tay: notes plus a day-by-day plan, shared by both people in the space.
 * See `@/lib/notebook` for why it exists and the limits.
 *
 * Deliberately NOT in the activity feed or the unread badge: a plan is edited
 * a cell at a time, all day, and every tick would land on the other person's
 * badge as news.
 */
const notebookSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    title: { type: String, required: true },
    slots: { type: [slotSchema], default: [] },
    days: { type: [daySchema], default: [] },
    sections: { type: [sectionSchema], default: [] },
    metric: {
      label: { type: String, default: "Cân" },
      unit: { type: String, default: "kg" },
      readings: { type: [pointSchema], default: [] },
      targets: { type: [pointSchema], default: [] },
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

// The list: this space's notebooks, most recently touched first.
notebookSchema.index({ spaceId: 1, updatedAt: -1 });

export type Notebook = InferSchemaType<typeof notebookSchema>;

export const NotebookModel = models.Notebook ?? model("Notebook", notebookSchema);
