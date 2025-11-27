import { supabase } from "../core/supabase";
import { SalvageUnionReference } from "salvageunion-reference";

/**
 * Find Supabase user ID by Discord user ID
 * Uses RPC function to query auth.identities table (auth schema not directly accessible)
 *
 * Note: You need to create this function in Supabase SQL Editor:
 *
 * CREATE OR REPLACE FUNCTION get_user_by_discord_id(discord_id TEXT)
 * RETURNS UUID AS $$
 * DECLARE
 *   found_user_id UUID;
 * BEGIN
 *   SELECT i.user_id INTO found_user_id
 *   FROM auth.identities i
 *   WHERE i.provider = 'discord'
 *     AND i.provider_user_id = discord_id
 *   LIMIT 1;
 *
 *   RETURN found_user_id;
 * END;
 * $$ LANGUAGE plpgsql SECURITY DEFINER;
 */
export async function getUserByDiscordId(discordId: string) {
  try {
    // Use RPC function to access auth.identities
    const { data, error } = await supabase.rpc("get_user_by_discord_id", {
      discord_id: discordId,
    });

    if (error) {
      // If function doesn't exist, provide helpful error
      if (error.code === "42883" || error.message?.includes("function")) {
        console.error(
          "Error: get_user_by_discord_id function not found. Please create it in Supabase SQL Editor."
        );
        console.error("Full error:", JSON.stringify(error, null, 2));
        return null;
      }
      console.error("Error calling get_user_by_discord_id RPC:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return null;
    }

    if (data) {
      return { id: data };
    }

    return null;
  } catch (err: any) {
    console.error("Error in getUserByDiscordId:", err);
    console.error("Error stack:", err.stack);
    return null;
  }
}

/**
 * Get games for a user (both created by them and games they're a member of)
 */
export async function getUserGames(userId: string) {
  // Get games where user is the creator
  const { data: createdGames, error: createdError } = await supabase
    .from("games")
    .select("id, name")
    .eq("created_by", userId);

  if (createdError) {
    throw createdError;
  }

  // Get game IDs where user is a member
  const { data: memberGameIds, error: memberError } = await supabase
    .from("game_members")
    .select("game_id")
    .eq("user_id", userId);

  if (memberError) {
    throw memberError;
  }

  // Combine and deduplicate game IDs
  const gameIdSet = new Set<string>();
  (createdGames || []).forEach((g) => {
    if (g.id) {
      gameIdSet.add(g.id);
    }
  });
  (memberGameIds || []).forEach((m) => {
    if (m.game_id) {
      gameIdSet.add(m.game_id);
    }
  });

  // If no games found, return empty array
  if (gameIdSet.size === 0) {
    return [];
  }

  // Fetch all unique games with their names
  const gameIds = Array.from(gameIdSet);
  const { data: allGames, error: gamesError } = await supabase
    .from("games")
    .select("id, name")
    .in("id", gameIds);

  if (gamesError) {
    throw gamesError;
  }

  // Get member counts for all games
  const { data: memberCounts, error: memberCountError } = await supabase
    .from("game_members")
    .select("game_id")
    .in("game_id", gameIds);

  if (memberCountError) {
    console.error("Error fetching member counts:", memberCountError);
  }

  // Count members per game
  const memberCountMap = new Map<string, number>();
  (memberCounts || []).forEach((member: any) => {
    if (member.game_id) {
      memberCountMap.set(
        member.game_id,
        (memberCountMap.get(member.game_id) || 0) + 1
      );
    }
  });

  return (allGames || []).map((g) => ({
    id: g.id,
    name: g.name || "Unnamed Game",
    member_count: memberCountMap.get(g.id) || 0,
  }));
}

/**
 * Get mechs for a user
 * Chassis is a suentity related to the mech, and we need to lookup its name in salvageunion-reference package
 *
 * Flow:
 * 1. Query suentity with mech_id = ? and schema_name = 'chassis'
 * 2. Read schema_ref_id
 * 3. Look up the chassis in salvageunion-reference using schema_ref_id
 * 4. Extract name from the reference data
 */
export async function getUserMechs(userId: string) {
  // First, get all mechs for the user with stats
  const { data: mechs, error: mechsError } = await supabase
    .from("mechs")
    .select("id, pattern, current_damage, current_ep, current_heat, image_url")
    .eq("user_id", userId);

  if (mechsError) {
    throw mechsError;
  }

  if (!mechs || mechs.length === 0) {
    return [];
  }

  // Get all mech IDs
  const mechIds = mechs.map((m) => m.id);

  // Query all chassis entities for these mechs at once
  const { data: chassisEntities, error: chassisError } = await supabase
    .from("suentities")
    .select("mech_id, schema_ref_id")
    .in("mech_id", mechIds)
    .eq("schema_name", "chassis");

  if (chassisError) {
    console.error("Error fetching chassis entities:", chassisError);
    // Fall back to unknown for all
    return mechs.map((mech: any) => ({
      id: mech.id,
      chassis_name: "Unknown Chassis",
      pattern_name: mech.pattern || "Unknown Pattern",
      systems: [],
      modules: [],
    }));
  }

  // Query all systems and modules entities for these mechs at once
  const { data: systemsModulesEntities, error: systemsModulesError } =
    await supabase
      .from("suentities")
      .select("mech_id, schema_name, schema_ref_id")
      .in("mech_id", mechIds)
      .in("schema_name", ["systems", "modules"]);

  if (systemsModulesError) {
    console.error(
      "Error fetching systems/modules entities:",
      systemsModulesError
    );
  }

  // Build a map of mech_id -> schema_ref_id
  const mechToSchemaRefMap = new Map<string, string>();
  (chassisEntities || []).forEach((entity: any) => {
    if (entity.mech_id && entity.schema_ref_id) {
      // Convert to string in case it's stored as a number or UUID
      mechToSchemaRefMap.set(entity.mech_id, String(entity.schema_ref_id));
    }
  });

  // Get all chassis, systems, and modules from reference package once
  const allChassis = SalvageUnionReference.Chassis.all();
  const chassisByIdMap = new Map<string, (typeof allChassis)[0]>();
  allChassis.forEach((chassis) => {
    chassisByIdMap.set(chassis.id, chassis);
  });

  const allSystems = SalvageUnionReference.Systems.all();
  const systemsByIdMap = new Map<string, (typeof allSystems)[0]>();
  allSystems.forEach((system) => {
    systemsByIdMap.set(system.id, system);
  });

  const allModules = SalvageUnionReference.Modules.all();
  const modulesByIdMap = new Map<string, (typeof allModules)[0]>();
  allModules.forEach((module) => {
    modulesByIdMap.set(module.id, module);
  });

  // Build maps of mech_id -> chassis data (name and stats)
  const mechChassisMap = new Map<
    string,
    { name: string; chassis: (typeof allChassis)[0] | null }
  >();
  for (const mech of mechs) {
    const schemaRefId = mechToSchemaRefMap.get(mech.id);

    if (!schemaRefId) {
      console.warn(`No chassis entity found for mech ${mech.id}`);
      mechChassisMap.set(mech.id, { name: "Unknown Chassis", chassis: null });
      continue;
    }

    // Look up the chassis in salvageunion-reference using schema_ref_id
    const chassis = chassisByIdMap.get(schemaRefId);

    if (!chassis) {
      console.warn(
        `Chassis not found in reference for schema_ref_id: ${schemaRefId} (mech: ${mech.id})`
      );
      mechChassisMap.set(mech.id, { name: "Unknown Chassis", chassis: null });
      continue;
    }

    // Extract name from the reference data
    const chassisName = chassis.name || "Unknown Chassis";
    mechChassisMap.set(mech.id, { name: chassisName, chassis });
  }

  // Build maps of mech_id -> systems and modules arrays (with name and id)
  const mechSystemsMap = new Map<string, Array<{ name: string; id: string }>>();
  const mechModulesMap = new Map<string, Array<{ name: string; id: string }>>();

  // Initialize all mechs with empty arrays
  mechIds.forEach((mechId) => {
    mechSystemsMap.set(mechId, []);
    mechModulesMap.set(mechId, []);
  });

  // Process systems and modules entities
  (systemsModulesEntities || []).forEach((entity: any) => {
    if (!entity.mech_id || !entity.schema_ref_id) {
      return;
    }

    const schemaRefId = String(entity.schema_ref_id);

    if (entity.schema_name === "systems") {
      const system = systemsByIdMap.get(schemaRefId);
      if (system?.name) {
        const current = mechSystemsMap.get(entity.mech_id) || [];
        current.push({ name: system.name, id: schemaRefId });
        mechSystemsMap.set(entity.mech_id, current);
      }
    } else if (entity.schema_name === "modules") {
      const module = modulesByIdMap.get(schemaRefId);
      if (module?.name) {
        const current = mechModulesMap.get(entity.mech_id) || [];
        current.push({ name: module.name, id: schemaRefId });
        mechModulesMap.set(entity.mech_id, current);
      }
    }
  });

  // Combine mech data with chassis names, systems, and modules
  return mechs.map((mech: any) => {
    const chassisData = mechChassisMap.get(mech.id) || {
      name: "Unknown Chassis",
      chassis: null,
    };
    const chassis = chassisData.chassis;

    // Get image URL: user-uploaded image takes priority, fallback to chassis asset_url from reference
    const userImageUrl = mech.image_url || null;
    const defaultAssetUrl = chassis?.asset_url || null;
    const imageUrl = userImageUrl || defaultAssetUrl;

    return {
      id: mech.id,
      chassis_name: chassisData.name,
      pattern_name: mech.pattern || "Unknown Pattern",
      systems: mechSystemsMap.get(mech.id) || [],
      modules: mechModulesMap.get(mech.id) || [],
      // Image URL (user image or fallback to reference asset)
      image_url: imageUrl,
      // Mech stats from database
      current_damage: mech.current_damage,
      current_ep: mech.current_ep,
      current_heat: mech.current_heat,
      // Chassis stats from reference (stats are directly on chassis object)
      chassis_tech_level: chassis?.techLevel,
      chassis_structure_points: chassis?.structurePoints,
      chassis_energy_points: chassis?.energyPoints,
      chassis_heat_capacity: chassis?.heatCapacity,
      chassis_system_slots: chassis?.systemSlots,
      chassis_module_slots: chassis?.moduleSlots,
    };
  });
}

/**
 * Get pilots for a user
 * Also fetches class information and motto
 */
export async function getUserPilots(userId: string) {
  const { data, error } = await supabase
    .from("pilots")
    .select(
      "id, callsign, motto, image_url, current_damage, current_ap, max_ap"
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Get all pilot IDs
  const pilotIds = data.map((p) => p.id);

  // Query all class entities for these pilots at once
  const { data: classEntities, error: classError } = await supabase
    .from("suentities")
    .select("pilot_id, schema_ref_id")
    .in("pilot_id", pilotIds)
    .eq("schema_name", "classes");

  if (classError) {
    console.error("Error fetching class entities:", classError);
  }

  // Query all abilities entities for these pilots at once (only direct abilities, not granted ones)
  const { data: abilitiesEntities, error: abilitiesError } = await supabase
    .from("suentities")
    .select("pilot_id, schema_ref_id")
    .in("pilot_id", pilotIds)
    .eq("schema_name", "abilities")
    .is("parent_entity_id", null);

  if (abilitiesError) {
    console.error("Error fetching abilities entities:", abilitiesError);
  }

  // Get all classes and abilities from reference package once
  const allClasses = SalvageUnionReference.Classes.all();
  const classByIdMap = new Map<string, (typeof allClasses)[0]>();
  allClasses.forEach((cls) => {
    classByIdMap.set(cls.id, cls);
  });

  const allAbilities = SalvageUnionReference.Abilities.all();
  const abilitiesByIdMap = new Map<string, (typeof allAbilities)[0]>();
  allAbilities.forEach((ability) => {
    abilitiesByIdMap.set(ability.id, ability);
  });

  // Build a map of pilot_id -> classes (base and advanced) with both names and objects
  const pilotClassesMap = new Map<
    string,
    {
      base: { name: string | null; class: (typeof allClasses)[0] | null };
      advanced: { name: string | null; class: (typeof allClasses)[0] | null };
    }
  >();

  // Initialize all pilots with null classes
  pilotIds.forEach((pilotId) => {
    pilotClassesMap.set(pilotId, {
      base: { name: null, class: null },
      advanced: { name: null, class: null },
    });
  });

  // Process class entities
  (classEntities || []).forEach((entity: any) => {
    if (!entity.pilot_id || !entity.schema_ref_id) {
      return;
    }

    const classData = classByIdMap.get(String(entity.schema_ref_id));
    if (!classData) {
      return;
    }

    const current = pilotClassesMap.get(entity.pilot_id) || {
      base: { name: null, class: null },
      advanced: { name: null, class: null },
    };

    // Determine if this is a base class or advanced/hybrid class
    // Advanced/Hybrid class: hybrid === true (takes priority)
    // Base class: coreTrees exists and hybrid !== true
    // Use type guard: check if it has 'hybrid' property (advanced class) or 'coreTrees' (base class)
    const isAdvancedClass = "hybrid" in classData && classData.hybrid === true;
    const isBaseClass =
      !isAdvancedClass &&
      "coreTrees" in classData &&
      classData.coreTrees &&
      ("hybrid" in classData ? classData.hybrid !== true : true);

    if (isAdvancedClass && !current.advanced.name) {
      current.advanced.name = classData.name || null;
      current.advanced.class = classData;
    } else if (isBaseClass && !current.base.name) {
      current.base.name = classData.name || null;
      current.base.class = classData;
    }

    pilotClassesMap.set(entity.pilot_id, current);
  });

  // Build map of pilot_id -> abilities array (with name and id)
  const pilotAbilitiesMap = new Map<
    string,
    Array<{ name: string; id: string }>
  >();

  // Initialize all pilots with empty arrays
  pilotIds.forEach((pilotId) => {
    pilotAbilitiesMap.set(pilotId, []);
  });

  // Process abilities entities
  (abilitiesEntities || []).forEach((entity: any) => {
    if (!entity.pilot_id || !entity.schema_ref_id) {
      return;
    }

    const schemaRefId = String(entity.schema_ref_id);
    const ability = abilitiesByIdMap.get(schemaRefId);

    if (ability?.name) {
      const current = pilotAbilitiesMap.get(entity.pilot_id) || [];
      current.push({ name: ability.name, id: schemaRefId });
      pilotAbilitiesMap.set(entity.pilot_id, current);
    }
  });

  // Combine pilot data with class names, stats, abilities, and image URLs
  return data.map((pilot: any) => {
    const classes = pilotClassesMap.get(pilot.id) || {
      base: { name: null, class: null },
      advanced: { name: null, class: null },
    };

    // Get image URL: user-uploaded image takes priority, fallback to class asset_url from reference
    // Use hybrid class asset_url if present, otherwise core class asset_url
    const userImageUrl = pilot.image_url || null;
    const defaultAssetUrl =
      classes.advanced.class?.asset_url ||
      classes.base.class?.asset_url ||
      null;
    const imageUrl = userImageUrl || defaultAssetUrl;

    return {
      id: pilot.id,
      callsign: pilot.callsign,
      motto: pilot.motto,
      class_name: classes.base.name,
      advanced_class_name: classes.advanced.name,
      image_url: imageUrl,
      current_damage: pilot.current_damage,
      current_ap: pilot.current_ap,
      max_ap: pilot.max_ap,
      abilities: pilotAbilitiesMap.get(pilot.id) || [],
    };
  });
}

/**
 * Get crawlers for a user
 * Crawler type is a suentity related to the crawler, and we need to lookup its tech level in salvageunion-reference package
 *
 * Flow:
 * 1. Query suentity with crawler_id = ? and schema_name = 'crawler'
 * 2. Read schema_ref_id
 * 3. Look up the crawler type in salvageunion-reference using schema_ref_id
 * 4. Extract tech level from the reference data
 */
export async function getUserCrawlers(userId: string) {
  // First, get all crawlers for the user
  const { data: crawlers, error: crawlersError } = await supabase
    .from("crawlers")
    .select("id, name")
    .eq("user_id", userId);

  if (crawlersError) {
    throw crawlersError;
  }

  if (!crawlers || crawlers.length === 0) {
    return [];
  }

  // Get all crawler IDs
  const crawlerIds = crawlers.map((c) => c.id);

  // Query all crawler type entities for these crawlers at once
  const { data: crawlerTypeEntities, error: crawlerTypeError } = await supabase
    .from("suentities")
    .select("crawler_id, schema_ref_id")
    .in("crawler_id", crawlerIds)
    .eq("schema_name", "crawler");

  if (crawlerTypeError) {
    console.error("Error fetching crawler type entities:", crawlerTypeError);
    // Return crawlers without tech level if query fails
    return crawlers.map((crawler: any) => ({
      ...crawler,
      tech_level: null,
    }));
  }

  // Get all crawler tech levels from reference package once
  // Note: schema_name 'crawler' might map to crawler-tech-levels, not the crawler itself
  const allCrawlerTechLevels = SalvageUnionReference.CrawlerTechLevels.all();
  const crawlerTechLevelByIdMap = new Map<
    string,
    (typeof allCrawlerTechLevels)[0]
  >();
  allCrawlerTechLevels.forEach((techLevel) => {
    crawlerTechLevelByIdMap.set(techLevel.id, techLevel);
  });

  // Build a map of crawler_id -> tech level
  const crawlerTechLevelMap = new Map<string, number | null>();

  // Initialize all crawlers with null tech level
  crawlerIds.forEach((crawlerId) => {
    crawlerTechLevelMap.set(crawlerId, null);
  });

  // Process crawler type entities
  (crawlerTypeEntities || []).forEach((entity: any) => {
    if (!entity.crawler_id || !entity.schema_ref_id) {
      return;
    }

    const crawlerTechLevel = crawlerTechLevelByIdMap.get(
      String(entity.schema_ref_id)
    );
    if (!crawlerTechLevel) {
      return;
    }

    // Extract tech level from the reference data
    const techLevel = crawlerTechLevel.techLevel ?? null;
    crawlerTechLevelMap.set(entity.crawler_id, techLevel);
  });

  // Combine crawler data with tech levels
  return crawlers.map((crawler: any) => ({
    id: crawler.id,
    name: crawler.name,
    tech_level: crawlerTechLevelMap.get(crawler.id) ?? null,
  }));
}
