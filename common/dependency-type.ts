/**
 * The dependency relationship
 * Based on Fabric's dependency system
 * https://fabricmc.net/wiki/documentation:fabric_mod_json
 */
export enum DependencyType {
  /**
   * Should display an error if this mod is missing
   */
  depends = 'depends',

  /**
   * Should display a warning if this mod is missing
   */
  recommends = 'recommends',

  /**
   * No special behavior. List suggestions on store page.
   */
  suggests = 'suggests',

  /**
   * Should display a warning if this mod is present
   */
  breaks = 'breaks',

  /**
   * Should display an error if this mod is present
   */
  conflicts = 'conflicts',
}
