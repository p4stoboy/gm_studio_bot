import {ChatInputCommandInteraction, EmbedBuilder, HexColorString} from "discord.js";
import {collections} from "../collections";
import {choose} from "../helpers";
import {token_embed} from "../discord_functions/token_embed";
import {GMCollection} from "../types/GMCollection";
import {TokenData} from "../types/TokenData";


// EVERY COMMAND CALLS THESE FUNCTIONS
// ::check_retry
// this checks whether the image loaded in to the embed after 10 seconds, if not it resends the embed alternating between
// max quality (95) and pretty good (80) until the image resolves.
// quality gets alternated because the URL needs to change for Discord to retry the request, but we don't want to drop it
// too low so we alternate.
const check_retry = async (interaction: ChatInputCommandInteraction, _embed: EmbedBuilder, url: string, side = 1) => {
  const message = await interaction.fetchReply();
  if (!message) throw new Error('no message found');
  const embed = message.embeds[0];
  if (embed.image?.width === 0) {
    await interaction.editReply({embeds: [_embed.setImage((side < 0 ? url + '?img-quality=75' : url + '?img-quality=60'))]});
    setTimeout(async () => await check_retry(interaction, _embed, url, -side), 10000);
  }
}

// filter supplied trait options over collection recursively and return what's left
const filter_options = (interaction: ChatInputCommandInteraction, collection: GMCollection): [TokenData[], string] => {
  const options = interaction.options.data;
  let trait_string = '';
  let tokens = [...collection.tokens];
  for (let option of options) {
    if (option.name === "token_id") continue;
    const name = option.name.includes("page") ? option.name.split("_")[0] : option.name;
    tokens = tokens.filter(token => token.attributes[name] === option.value);
    trait_string += `${name}: *${option.value}*\n`;
  }
  return [tokens, trait_string.slice(0, -1)];
}

// main function to parse all command parameters and return embed to interaction
export const gm_func = async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply();
  // try and get collection from command name / default to random pattern
  const filter = collections.filter(x => x.slug === interaction.commandName)[0];
  const collection = filter ? filter : choose(collections);

  // get token id
  const id_input = interaction.options.get('token_id');
  const [filtered, trait_string] = filter_options(interaction, collection); // will be whole collection if no traits supplied
  if (!id_input && filtered.length === 0) {
    await interaction.editReply({content: `No ${collection.name} found with [${trait_string}].`});
    setTimeout(async () => await interaction.deleteReply(), 5000);
    return;
  }
  const id: number = id_input ? id_input.value as number : choose(filtered).tokenId;
  const is_traits = !id_input;

  // TODO: keep an eye out for conditional option implementations so we can not have a separate command
  //  for each collection whilst retaining the appropriate parameter coercions

  //get token data --> API CALL USING get_token_data can go here.
  const token_data = collection.tokens[id];
  //await get_token_data(collection.slug, id).catch((e) => console.log(e));
  // if (!token_data) return;
  //build embed
  const hex = '#2F3136';
  const embed = token_embed(token_data, hex as HexColorString, collection, is_traits, trait_string);

  const message = await interaction.editReply({embeds: [embed]}).catch((e) => console.log(e));
  if (!message) return;
  setTimeout(async () => await check_retry(interaction, embed, token_data.image), 10000);
}
