# MODCODES Learning Journal

This journal documents my engineering journey while building MODCODES.

Instead of only tracking completed features, it records the concepts learned, architectural decisions made, mistakes encountered, and engineering principles discovered throughout the development process.

---

# Day 1

## Sprint

Project Foundation

---

## Built

- Initial Next.js application
- Sidebar component
- Workspace component
- Welcome component
- Quick Actions component
- Recent Projects component
- Chat Input component

---

## Learned

### React

- Functional Components
- Component Composition
- Import / Export
- Project Structure

### CSS

- Flexbox
- Flex Direction
- Gap
- Flex Grow
- Justify Content
- Padding
- Responsive Layout

### Architecture

- Single Responsibility Principle
- Breaking UI into reusable components
- Organizing components by feature

---

## Biggest Takeaway

A clean architecture makes future development significantly easier than keeping everything inside one file.

---

# Day 2

## Sprint

UI Engineering

---

## Built

- Complete sidebar redesign
- IDE inspired workspace
- Modern chat composer
- Lucide React integration
- Button system
- Design System
- Interactive hover & active states

---

## Learned

### React

- Third-party library integration
- React components can represent icons

### CSS

- Pseudo classes
- Hover effects
- Active states
- Visual hierarchy
- Design consistency

### UI Engineering

- Layout vs Appearance
- Component ownership
- Design Tokens
- Reusable button styles
- Modern IDE design principles

---

## Biggest Takeaway

Frontend engineering is not about writing CSS.

It is about designing reusable, scalable user interfaces with clear responsibilities.

---

# Day 3

## Sprint

Planning Interactive Features

---

## Built

- Planned Create Project modal
- Created initial modal UI
- Learned semantic HTML for forms

---

## Learned

### HTML

- form
- label
- input
- select
- option
- checkbox
- button types

### React

- Introduction to useState
- Understanding component state
- Why state belongs to the lowest common parent
- React component communication

### Software Engineering

Before writing functionality, design the architecture.

Understand:

- Who owns the state?
- Who triggers the action?
- Who consumes the result?

---

## Biggest Takeaway

React state is not just a variable.

It is information that changes over time and automatically updates the UI.

---

# Day 4

## Focus

Implemented the first complete React feature in MODCODES.

## What I Built

- Create Project modal
- Modal backdrop
- Modal open/close using useState
- Controlled form inputs
- Project creation workflow
- Recent Projects list
- Dynamic rendering using map()

## What I Learned

### React State

- useState
- State updates
- Controlled components

### Forms

- value
- checked
- onChange
- onSubmit
- preventDefault()

### React Data Flow

- Parent owns state
- Child receives props
- Child sends data back using callback functions

### Rendering

- Conditional rendering
- map()
- key prop

## Biggest Learning

React applications are built by moving data through components rather than manipulating the DOM directly.

---

# Day 5

## Focus

Implemented the complete project creation workflow and local persistence.

## What I Built

- Create Project modal with controlled form inputs
- Project creation using React state
- Parent-child communication with props and callbacks
- Dynamic Recent Projects list
- Project persistence using localStorage
- Automatic project loading on application startup using useEffect

## What I Learned

### React Hooks

- useState
- useEffect

### Forms

- Controlled components
- value vs checked
- onChange
- onSubmit
- preventDefault()

### State Management

- Parent owns shared state
- Child sends data through callback props
- Immutable array updates using the spread operator

### Rendering

- Conditional rendering
- Rendering lists with map()
- Importance of the key prop

### Browser APIs

- localStorage.setItem()
- localStorage.getItem()
- JSON.stringify()
- JSON.parse()

## Biggest Learning

React state is temporary. localStorage allows applications to persist data across page refreshes by serializing JavaScript objects into JSON strings.

---

# Day 6

## Focus

Implemented project deletion, improved project list UI, and strengthened understanding of React event handling and immutable state updates.

## What I Built

- Project deletion functionality
- Delete button for each project
- Dynamic project removal using filter()
- Automatic localStorage updates after deletion
- React state synchronization after deletion
- Improved Recent Projects UI using Flexbox
- Styled Delete button with hover and active states

## What I Learned

### React

- filter()
- Event handlers
- onClick
- Passing callback functions as props
- Difference between passing a function and calling a function
- Arrow functions inside event handlers

### State Management

- Immutable array updates using filter()
- Synchronizing React state with localStorage
- React automatically re-renders after state updates

### CSS

- Flexbox layouts
- justify-content
- align-items
- gap
- Component-specific class naming
- Building reusable UI cards

### Software Engineering

- Parent components own shared state.
- Child components trigger actions through callback props.
- Features should be functional first, then refactored for readability.
- Consider edge cases early, such as duplicate project names.
- Component responsibilities should remain focused and maintainable.

## Biggest Learning

A complete feature is more than just business logic. It includes user interaction, state management, persistence, UI design, and thinking about future scalability.

---

## Current Project Status

### Completed

- Modern IDE UI
- Component Architecture
- Design System
- Sidebar
- Workspace
- Chat Composer
- Quick Actions
- Recent Projects
- Lucide Icons
- Create Project Workflow
- Project Persistence using localStorage
- Project Deletion
- Delete Button UI

### Currently Working On

- Project List UI Improvements
- Component Refactoring
- Preparing for Unique Project IDs

### Upcoming

- Unique Project IDs
- ProjectItem Component
- Edit Project
- Search Projects
- File Explorer
- Monaco Editor
- Terminal
- AI Chat