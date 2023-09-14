import fetch from 'node-fetch';
import fs from 'fs';
import * as collections_data from "../collections.json";
import {valid} from "./discord_command_regex";
import {TokenData} from "../types/TokenData";
import path from 'path';

const collection = collections_data.collections[collections_data.collections.length - 1];

// dump every token from API to its own collection file
const dump_token_metadata = async () => {
  const api_data = [];
    const current = [];
    for (let id = 0; id < collection.size; id++) {
      console.log(collection.name + ": " + id);
      const response = await fetch(`https://api.gmstudio.art/collections/${collection.slug}/token/${id}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const token_data: TokenData = await response.json();
      // map attribute strings to Discord command compliant strings
      const new_attributes: {[key: string]: string} = {};
      for (let [key, value] of Object.entries(token_data.attributes)) {
        new_attributes[valid(key)] = valid(value.toString());
      }
      token_data.attributes = new_attributes;
      current.push(token_data);
    }
    const json = {"root": current};
    fs.writeFileSync(path.join(__dirname, `../token_metadata/${collection.slug}.json`), JSON.stringify(json));
    dump_attribute_dictionary(current);
}

// Generate feature map for each collection and
// map attribute strings to Discord command compliant strings
const dump_attribute_dictionary = (tokens: TokenData[]) => {
    let attributes: { name: string, values: string[] }[] = [];
    for (let token of tokens) {
      const token_attributes = token.attributes;
      for (let [key, value] of Object.entries(token_attributes)) {
        const array_has_key = attributes.some((attribute) => attribute.name === valid(key));
        if (!array_has_key) {
          attributes.push({name: valid(key), values: [valid(value.toString())]});
        } else {
          const array_has_value = attributes.some((attribute) => {
            return attribute.values.includes(valid(value.toString())) && attribute.name === valid(key);
          });
          if (!array_has_value) {
            attributes.find((attribute) => attribute.name === valid(key))?.values.push(valid(value.toString()));
          }
        }
      }
    }
    const json = {root: attributes};
    fs.writeFileSync(path.join(__dirname, `../token_metadata/${collection.slug}_attribute_dictionary.json`), JSON.stringify(json, null, 2));
}

dump_token_metadata();
