<template>
    <transition>
        <svg :class="{ show: show }" v-show="show" width="44px" height="44px" viewBox="0 0 44 44" class="spinner">
            <circle fill="none" stroke-width="4" stroke-linecap="round" cx="22" cy="22" r="20" class="path"></circle>
        </svg>
    </transition>
</template>

<script>
    export default {
        name: 'spinner',
        props: ['show'],
        serverCacheKey: props => props.show
    }
</script>

<style lang="stylus">
$offset = 126
$duration = 1.4s

.spinner
    position fixed
    z-index 99
    right 15px
    bottom 15px
    transition opacity .15s ease
    animation rotator $duration linear infinite
    &.show
        animation-play-state running
    &.v-enter, &.v-leave-active
        opacity 0
    &.v-enter-active, &.v-leave
        opacity 1

@keyframes rotator
    0%
        transform scale(0.5) rotate(0deg)
    100%
        transform scale(0.5) rotate(270deg)

.spinner .path
    stroke #ff6600
    storke-dasharray $offset
    stroke-dashoffset 0
    transform-orgin center
    animation dash $duration ease-in-out infinite

@keyframes dash
    0%
        stroke-dashoffset $offset
    50%
        stroke-dashoffset ($offset/2)
        transform rotate(135deg)
    100%
        stroke-dashoffset $offset
        tansform rotate(450deg)

</style>