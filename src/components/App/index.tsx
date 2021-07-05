import React, { useState, useEffect, useRef } from 'react';
import styles from './styles.scss';

// Data
import { electorates } from '../../data/electorates';
import type { Electorate } from '../../data/electorates';
import { sa2 } from '../../data/sa2';
import { postcodes } from '../../data/postcode';
import Fuse from 'fuse.js';

const australiaAgree = 60.6;

type Autocomplete = {
  type: 'sa2' | 'electorate',
  name: string,
  display: string,
  state: string | null,
  terms: string[],
};

let autocomplete: Autocomplete[] = [];
let sa2sProcessed = new Set<string>();
for (let s of sa2) {
  let lookup = s.name;
  if (!sa2sProcessed.has(lookup)) {
    let terms = s.name.split(' - ');
    if (s.state) {
      terms.push(s.state);
    }
    autocomplete.push({
      type: 'sa2',
      name: s.name,
      display: s.name.replace(/ - /g, ' / ').replace(/ \(.*\)$/, ''),
      state: s.state,
      terms,
    });
    sa2sProcessed.add(lookup);
  }
}
for (let e of electorates) {
  autocomplete.push({
    type: 'electorate',
    name: e.name,
    display: e.name,
    state: e.state,
    terms: [e.name, e.state],
  });
}

let autocompleteSearch = new Fuse(autocomplete, { threshold: 0.33, keys: ['terms'] });

let electorateLookup: { [name: string]: Electorate } = {};
for (let e of electorates) {
  electorateLookup[e.name] = e;
}

export type AppProps = {
}

let counter = 0;

const App: React.FC<AppProps> = props => {
  let [isIframe] = useState((window.self !== window.top) || document.body.classList.contains('iframe'));
  let containerElement = useRef<HTMLDivElement | null>(null);
  let [searchInput, setSearchInput] = useState('');
  let [activeElectorates, setActiveElectorates] = useState<string[]>([]);
  let [activeAutocomplete, setActiveAutocomplete] = useState<Autocomplete[]>([]);
  let [autocompleteSelectedIndex, setAutocompleteSelectedIndex] = useState(0);
  let [searchResultsHeading, setSearchResultsHeading] = useState('');
  let [inputId] = useState('aus-talks-local-indigenous-lookup-input-'+(counter++));
  let [containerHeight, setContainerHeight] = useState<number | undefined>(undefined);
  let [updateSizeDebounce, setUpdateSizeDebounce] = useState<number | undefined>(undefined);
  let updateSize = () => {
    if (updateSizeDebounce) {
      return;
    }
    let newUpdateSizeDebounce = window.setTimeout(() => {
      setUpdateSizeDebounce(undefined);
      if (containerElement.current instanceof HTMLDivElement) {
        let newContainerHeight: number = Math.ceil(containerElement.current.scrollHeight)+32;
        if (containerHeight !== newContainerHeight) {
          setContainerHeight(newContainerHeight);
          if (isIframe) {
            window.parent.postMessage({ sentinel: 'amp', type: 'embed-size', height: newContainerHeight }, '*'); // notify parent page (AMP compatible)
          }
        }
      }
    }, 100);
    setUpdateSizeDebounce(newUpdateSizeDebounce);
  };
  window.addEventListener('resize', updateSize);
  window.addEventListener('orientationchange', updateSize);
  useEffect(updateSize, [activeElectorates, searchResultsHeading]);
  let accept = () => {
    let a = activeAutocomplete[autocompleteSelectedIndex];
    if (a.type === 'sa2') {
      let matchingSa2s = sa2.filter(s => s.name === a.name).sort((a, b) => b.sa1_count - a.sa1_count);
      let totalMeshblocks = 0;
      matchingSa2s.forEach(s => totalMeshblocks += s.meshblock_count);
      let minMeshblocks = totalMeshblocks * 0.1;
      matchingSa2s = matchingSa2s.filter(s => s.meshblock_count >= minMeshblocks);
      let newActiveElectorates = matchingSa2s.map(s => s.electorate);
      newActiveElectorates = [ ...new Set(newActiveElectorates) ]; // remove any duplicates
      setActiveElectorates(newActiveElectorates);
      setSearchResultsHeading((newActiveElectorates.length === 1 ? '1 electorate in ' : newActiveElectorates.length+' electorates in ')+(a.state ? `${a.display}, ${a.state}` : a.display));
    }
    else { // electorate
      setActiveElectorates([a.name]);
      setSearchResultsHeading('');
    }
    setActiveAutocomplete([]);
    setAutocompleteSelectedIndex(0);
    setSearchInput('');
  };
  let handleKey = (keyCode: number) => {
    if (keyCode === 13 || keyCode === 9 || keyCode === 27) { // enter or tab or esc
      accept();
    }
    if (keyCode === 38) { // up
      setAutocompleteSelectedIndex(Math.max(autocompleteSelectedIndex - 1, 0));
    }
    if (keyCode === 40) { // down
      setAutocompleteSelectedIndex(Math.min(autocompleteSelectedIndex + 1, activeAutocomplete.length - 1));
    }
  };
  let search = () => {
    let newActiveElectorates: string[] = [];
    if (!searchInput || /^\d$/.test(searchInput)) {
      // incomplete postcode or empty search
      setActiveAutocomplete([]);
      setAutocompleteSelectedIndex(0);
    }
    else if (/^\d{4}$/.test(searchInput)) {
      // complete postcode
      let searchInputAsNumber = parseInt(searchInput, 10);
      let matchingPostcodes = postcodes.filter(p => p.postcode === searchInputAsNumber).sort((a, b) => b.sa1_count - a.sa1_count);
      let totalMeshblocks = 0;
      matchingPostcodes.forEach(p => totalMeshblocks += p.meshblock_count);
      let minMeshblocks = totalMeshblocks * 0.1;
      matchingPostcodes = matchingPostcodes.filter(p => p.meshblock_count >= minMeshblocks);
      newActiveElectorates = matchingPostcodes.map(p => p.electorate);
      newActiveElectorates = [ ...new Set(newActiveElectorates) ]; // remove any duplicates
      setActiveElectorates(newActiveElectorates);
      setActiveAutocomplete([]);
      setAutocompleteSelectedIndex(0);
      setSearchResultsHeading(`${newActiveElectorates.length === 1 ? '1 electorate' : newActiveElectorates.length+' electorates'} in postcode ${searchInput}`);
    }
    else {
      // suburb or electorate search
      let results = autocompleteSearch.search(searchInput);
      setActiveAutocomplete(results.slice(0, 5).map(result => result.item));
      setAutocompleteSelectedIndex(0);
    }
  };
  useEffect(search, [searchInput]);
  return (
    <div className={styles['aus-talks-local-indigenous-lookup']} ref={containerElement} data-containerheight={containerHeight}>
      <div className="search">
        <div className="form">
          <label htmlFor={inputId}>Search</label>
          <input id={inputId} type="text" placeholder="Postcode, suburb or electorate" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => handleKey(e.keyCode)} />
        </div>
        <ul>
          { activeAutocomplete.map((a, i) => {
            return <li data-index={i} data-type={a.type} data-name={a.name} className={i === autocompleteSelectedIndex ? 'active' : undefined} onMouseOver={e => setAutocompleteSelectedIndex(i)} onClick={accept}><span className="type">{a.type === 'sa2' ? 'Suburb' : 'Electorate'}</span> <span className="display">{a.state ? a.display+', '+a.state : a.display}</span></li>;
          })}
        </ul>
      </div>
      {
        activeElectorates.length > 0 ? (
          <div className="results">
            { searchResultsHeading ? <h2>{searchResultsHeading}</h2> : undefined }
            <table className="electorates">
              <tbody>
                { activeElectorates.map(name => {
                  let electorate = electorateLookup[name];
                  return electorate ? <tr key={electorate.name}>
                    <td className="name">{electorate.name}</td>
                    <td className="chart"><span><span style={{ width: electorate.agree.toFixed(0)+'%' }}></span></span></td>
                    <td className="value">{electorate.agree.toFixed(0)}% agree</td>
                  </tr> : undefined;
                })}
                <tr className="australia" key="australia">
                  <td className="name">National average</td>
                  <td className="chart"><span><span style={{ width: australiaAgree.toFixed(0)+'%' }}></span></span></td>
                  <td className="value">{australiaAgree.toFixed(0)}% agree</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : undefined
      }
    </div>
  );
};

export default App;
