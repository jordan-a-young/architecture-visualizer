import type { RelationshipStyleRegistry } from 'archgraph-react';

// These meanings belong to this example application, not the visualization library.
export const relationshipStyles: RelationshipStyleRegistry = {
  calls: { label: 'Synchronous call', color: '#57779d', lineStyle: 'solid' },
  'routes-to': {
    label: 'Request routing',
    color: '#57779d',
    lineStyle: 'solid',
  },
  reads: { label: 'Data read', color: '#64866f', lineStyle: 'solid' },
  writes: { label: 'Data write', color: '#9b7b49', lineStyle: 'solid' },
  publishes: {
    label: 'Event publication',
    color: '#8a6895',
    lineStyle: 'dashed',
    description: 'Publishes an event for asynchronous processing.',
  },
  delivers: { label: 'Event delivery', color: '#8a6895', lineStyle: 'dashed' },
  'depends-on': {
    label: 'Package dependency',
    color: '#7b8797',
    lineStyle: 'dotted',
    description: 'Depends on shared code or message contracts.',
  },
};
