---
date: 2026-10-15
layout: post
publish: true
tags:
- coding-agents
- engineering
- systems-design
title: Coding Agents Make Careful Engineering Cheap
---

I think there are two ways in which people have been designing systems. The first approach is that you understand what the requirement is and then you try to build individual components to meet the high level vision of what you want to build. Essentially trying to correlate the input and output requirements of each of the components and how do they interact with each other and carefully building each component individually and then piecing together the entire system together

The second approach is you build the minimal version which works. You try to see if it meets the requirement or not. If it meets it, it's fine and you're good. If it does not, you go back to the whiteboard and try to understand what the system is lacking. You try to break it down into more components if it's possible or you can just keep on improving the current one. Once you are satisfied with the progress you gauge if what you built meets your purpose, if not you keep on doing it until it fits your requirement

There are different constraints or timelines, quality requirements, resources, or bandwidth, which allow you to make the decision of either going with the first approach or the second approach. For example: if you are a startup that is building something, then your first instinct should be to just build the version that you had in mind and then see how the society reacts to it. But if you are, let's say, a space organisation which wants to send a satellite or a piece of equipment to, let's say, Mars or the space station, you really can't just build the first thing which pops into your mind and then send it across (because the cost of failure is so high that you really can't afford to lose). You have to make sure that every individual component of the system which you are building is end-to-end stress tested and that it works correctly and it's not susceptible to failure. If you are a programmer then you can either go with a top-down approach or a bottom-up approach to building your application

I think the systems which are built using the first kind of approach have a really good property: they are much easier to maintain compared to the systems which are built using the second approach. I think because every individual component in the first approach has been primarily studied under various conditions, their properties as well as the way in which they behave are clearly understood. It becomes very much easier to then understand how the system would behave or evolve when put in some different situations or conditions. We might have some hypothesis about which components are susceptible to failure in these conditions or which components will stop working after a certain period of time. It's also much easier to change or completely swap out any of the components or change the way in which the system behaves altogether

With the rise in coding agents it seems to be that the approaches of the second kind are the ones which are going to be used by everyone. But there is a greater incentive to build systems using approaches of the first kind, using these AI coding agents or tools, it's much easier to study every individual component and map out the relations (like mapping out the way in which they are going to behave under different conditions) or study them in isolated or paired scenarios. It's much easier to consolidate all of this knowledge in, let's say, some skills or markdown files, and then share it across other teams or other agents of the same kind
