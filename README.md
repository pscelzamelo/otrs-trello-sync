# OTRS Trello Sync

## About this app

This app was made as a proof of concept on rendering OTRS tickets on a Kanban board. It serves unidirectional synchrony from OTRS to Trello. The app is still in development and is not recommended for production use - yet!

## Setup

The app requires node installed, then:

    $ npm install

Set your Trello and OTRS environment variables at config.js then:

    $ npm start
    
The app finds Queues and Boards with same names and sync the tickets!
