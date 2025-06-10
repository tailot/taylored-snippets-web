/**
 * @fileoverview Defines the MenuItem interface used in the side menu.
 */
import { Snippet } from '../sheet/sheet';

/**
 * Represents an item in the side menu.
 * Each menu item has a label and an array of snippets associated with it.
 */
export interface MenuItem {
  /** The display text for the menu item. */
  label: string;
  /** The array of snippets that are loaded when this menu item is selected. */
  snippets: Snippet[];
}
