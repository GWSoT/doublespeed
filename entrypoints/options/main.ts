import { mount } from 'svelte';
import '../../src/ui/theme.css';
import App from './App.svelte';

document.title = browser.i18n.getMessage('optionsTitle');
mount(App, { target: document.getElementById('app')! });
